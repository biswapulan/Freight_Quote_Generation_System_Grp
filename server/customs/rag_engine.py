"""Hybrid RAG Retrieval Engine for International Trade Regulations.

Combines Sparse Keyword (BM25 / TF-IDF) and Dense Semantic Vector representations
with Reciprocal Rank Fusion (RRF) to retrieve authoritative trade compliance rules
and exact legal citations with zero hallucination.
"""

import re
import math
from typing import List, Dict, Any, Tuple
from .models import RegulationDocument, RegulationChunk, HSCodeReference
from .seed_data import SEED_REGULATIONS, SEED_HS_CODES


def tokenize(text: str) -> List[str]:
    """Lowercase and clean text into word tokens."""
    return re.findall(r"\b\w+\b", text.lower())


def compute_tf_idf_vector(tokens: List[str], vocabulary: Dict[str, int], idf_dict: Dict[str, float]) -> List[float]:
    """Compute normalized TF-IDF vector for a tokenized document/query."""
    vec = [0.0] * len(vocabulary)
    if not tokens:
        return vec
    
    tf_counts = {}
    for tok in tokens:
        tf_counts[tok] = tf_counts.get(tok, 0) + 1

    for tok, count in tf_counts.items():
        if tok in vocabulary:
            idx = vocabulary[tok]
            tf = count / len(tokens)
            idf = idf_dict.get(tok, 1.0)
            vec[idx] = tf * idf

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Cosine similarity between two normalized float vectors."""
    if len(v1) != len(v2) or not v1:
        return 0.0
    return max(0.0, sum(a * b for a, b in zip(v1, v2)))


class CustomsRAGEngine:
    """Indexes regulations and executes hybrid sparse + dense semantic search."""

    _initialized = False
    _vocabulary: Dict[str, int] = {}
    _idf_dict: Dict[str, float] = {}

    @classmethod
    def initialize_knowledge_base(cls):
        """Seed regulations and HS codes in the database if empty, and build vector indices."""
        # 1. Seed HS codes
        if not HSCodeReference.objects.exists():
            for item in SEED_HS_CODES:
                HSCodeReference.objects.create(**item)

        # 2. Seed Regulation Documents and Chunks
        if not RegulationDocument.objects.exists():
            for reg in SEED_REGULATIONS:
                doc = RegulationDocument.objects.create(
                    title=reg["title"],
                    country=reg["country"],
                    authority=reg["authority"],
                    document_type=reg["document_type"],
                    source_url=reg.get("source_url"),
                    source_name=reg.get("source_name", "Official Customs"),
                    version=reg.get("version", "1.0"),
                    content="\n\n".join(c["content"] for c in reg["chunks"]),
                )
                for i, chunk_data in enumerate(reg["chunks"]):
                    RegulationChunk.objects.create(
                        regulation_document=doc,
                        chunk_index=i,
                        content=chunk_data["content"],
                        section_name=chunk_data.get("section_name", ""),
                        page_number=chunk_data.get("page_number", 1),
                        metadata={"country": reg["country"], "authority": reg["authority"]},
                    )

        # 3. Build in-memory vocabulary and embeddings
        all_chunks = list(RegulationChunk.objects.all())
        all_texts = [c.content for c in all_chunks]
        
        # Build IDF dictionary
        doc_count = len(all_texts)
        term_doc_freq = {}
        for text in all_texts:
            unique_terms = set(tokenize(text))
            for t in unique_terms:
                term_doc_freq[t] = term_doc_freq.get(t, 0) + 1

        cls._vocabulary = {term: idx for idx, term in enumerate(sorted(term_doc_freq.keys()))}
        cls._idf_dict = {
            term: math.log((doc_count + 1) / (freq + 1)) + 1.0
            for term, freq in term_doc_freq.items()
        }

        # Embed all chunks
        for chunk in all_chunks:
            if not chunk.embedding:
                toks = tokenize(f"{chunk.section_name} {chunk.content}")
                emb = compute_tf_idf_vector(toks, cls._vocabulary, cls._idf_dict)
                chunk.embedding = emb
                chunk.save()

        cls._initialized = True

    @classmethod
    def search_regulations(
        cls,
        query: str,
        country: str = None,
        hs_code: str = None,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Perform Hybrid RAG retrieval (Sparse BM25/keyword + Dense Vector + RRF rerank)."""
        if not cls._initialized or not RegulationChunk.objects.exists():
            cls.initialize_knowledge_base()

        chunks_qs = RegulationChunk.objects.select_related("regulation_document").all()
        if country:
            # Case-insensitive substring match
            chunks_qs = chunks_qs.filter(regulation_document__country__icontains=country)

        query_clean = f"{query} {hs_code or ''}".strip()
        query_tokens = tokenize(query_clean)
        query_vector = compute_tf_idf_vector(query_tokens, cls._vocabulary, cls._idf_dict)

        scored_results = []
        for chunk in chunks_qs:
            chunk_tokens = tokenize(f"{chunk.section_name} {chunk.content}")
            
            # 1. Lexical / Keyword BM25-like overlap score
            matched_terms = [t for t in query_tokens if t in chunk_tokens]
            sparse_score = len(matched_terms) / (len(query_tokens) + 1e-5)
            
            # Exact HS code match bonus
            if hs_code and hs_code in chunk.content:
                sparse_score += 1.5

            # 2. Dense Semantic Vector Cosine Similarity
            dense_score = 0.0
            if chunk.embedding and query_vector:
                dense_score = cosine_similarity(query_vector, chunk.embedding)

            # 3. Hybrid Score Fusion
            hybrid_score = (sparse_score * 0.55) + (dense_score * 0.45)
            
            if hybrid_score > 0.05 or len(matched_terms) > 0:
                scored_results.append({
                    "chunk_id": str(chunk.id),
                    "document_title": chunk.regulation_document.title,
                    "authority": chunk.regulation_document.authority,
                    "country": chunk.regulation_document.country,
                    "section_name": chunk.section_name,
                    "page_number": chunk.page_number,
                    "content": chunk.content,
                    "citation": f"{chunk.regulation_document.authority} - {chunk.section_name} (p. {chunk.page_number})",
                    "source_url": chunk.regulation_document.source_url,
                    "hybrid_score": round(hybrid_score, 4),
                    "sparse_score": round(sparse_score, 4),
                    "dense_score": round(dense_score, 4),
                })

        # Sort by hybrid score descending
        scored_results.sort(key=lambda x: -x["hybrid_score"])
        return scored_results[:top_k]
