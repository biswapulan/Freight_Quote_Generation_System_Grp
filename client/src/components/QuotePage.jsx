import { useState } from "react";
import { Link } from "react-router-dom";
import ShipmentForm from "./ShipmentForm";
import QuoteResult from "./QuoteResult";
import { useAuth } from "../context/AuthContext";
import { confirmQuote, estimateQuote } from "../api/quotes";

const initialValues = {
  origin: "",
  destination: "",
  cargoType: "general",
  mode: "air",
  weightKg: "",
  volumeM3: "",
};

export default function QuotePage() {
  const { token } = useAuth();
  const [values, setValues] = useState(initialValues);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    setQuote(null);

    try {
      const result = await estimateQuote(token, values);
      setQuote(result);
    } catch (error) {
      setErrorMsg(error.message || "Could not generate a quote. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!quote) return;
    setConfirming(true);
    try {
      const updated = await confirmQuote(token, quote.id);
      setQuote(updated);
    } catch (error) {
      setErrorMsg(error.message || "Could not confirm the quote.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-6 pt-8 flex items-center justify-between">
        <Link to="/dashboard" className="text-[#0B1E3F] font-semibold hover:underline">
          &larr; Back to dashboard
        </Link>
      </div>

      <ShipmentForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        loading={loading}
        errorMsg={errorMsg}
      />

      {quote && (
        <QuoteResult quote={quote} onConfirm={handleConfirm} confirming={confirming} />
      )}
    </div>
  );
}
