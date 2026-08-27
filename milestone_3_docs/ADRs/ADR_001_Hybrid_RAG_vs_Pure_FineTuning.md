# ADR 001: Hybrid TF-IDF RAG Architecture vs. Pure LLM Fine-Tuning for Customs Compliance

## Status: ACCEPTED

## Context
Cross-border customs compliance requires 100% deterministic precision when identifying mandatory export documents and citing statutory legal regulations (e.g. EU Dual-Use Regulation 2021/821, US ITAR, WCO Kyoto Convention). Hallucinated requirements or outdated regulatory knowledge can cause port cargo detentions and severe legal penalties.

## Decision
We chose a **Hybrid TF-IDF & Cosine Similarity Vector Retrieval (RAG)** approach backed by a deterministic local knowledge corpus of official customs circulars and HS tariff rules.

## Consequences
### Positive:
- **Zero Hallucinations**: All document requirements must be grounded in an indexed statutory text.
- **Instant Updates**: New national customs circulars can be added to the corpus immediately without expensive model re-training.
- **Ultra-Low Latency**: Sub-millisecond vector lookups on standard CPU instances without external LLM API costs.

### Negative:
- Semantic nuance is limited compared to dense multi-billion parameter neural embeddings, requiring structured keyword boost for trade lanes.
