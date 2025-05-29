"use client"

import type React from "react"
import { useRouter } from 'next/navigation'
import io from 'socket.io-client'
import { useEffect, useState } from "react"
import {
  ChartBarIcon,
  CheckCircleIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import Alert from "@/components/Alert";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { jwtDecode } from "jwt-decode"

type Bet = {
  id: number
  username: string
  amount: number
  side: "YES" | "NO"
  status: "PENDING" | "WON" | "LOST"
}

export default function AdminPage() {
  const [question, setQuestion] = useState("")
  const [yesOdds, setYesOdds] = useState("")
  const [noOdds, setNoOdds] = useState("")
  const [cutoffTime, setCutoffTime] = useState("")
  const [winningSide, setWinningSide] = useState("")
  const [bets, setBets] = useState<Bet[]>([])
  const [filterUsername, setFilterUsername] = useState("");
  const [filterSide, setFilterSide] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState<keyof Bet | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [lineMessage, setLineMessage] = useState({ text: "", type: "" });
  const [resolveMessage, setResolveMessage] = useState({ text: "", type: "" });
  const [showLineAlert, setShowLineAlert] = useState(false);
  const [showResolveAlert, setShowResolveAlert] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oddsFormat, setOddsFormat] = useState<"american" | "decimal">("american");

  const rowsPerPage = 10;
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };


  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
  
    try {
      const decoded: any = jwtDecode(token);
      if (!decoded.isAdmin) router.push("/home");
    } catch (err) {
      console.error("Invalid token:", err);
      router.push("/login");
    }
  }, []);

  const convertDecimalToAmerican = (decimalStr: string): string => {
    const dec = parseFloat(decimalStr);
    if (isNaN(dec) || dec < 1.01) return "";
    return dec >= 2 ? ((dec - 1) * 100).toFixed(0) : (-100 / (dec - 1)).toFixed(0);
  };

  const convertAmericanToDecimal = (americanStr: string): string => {
    const odds = parseFloat(americanStr);
    if (isNaN(odds)) return "";
    return odds > 0 ? (odds / 100 + 1).toFixed(2) : (100 / Math.abs(odds) + 1).toFixed(2);
  };

  const isInvalidDecimal = (value: string) => parseFloat(value) < 1.01;
  const isInvalidAmerican = (value: string) => isNaN(parseFloat(value));

  const handleSetLine = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");

    let yes = yesOdds;
    let no = noOdds;
    if (oddsFormat === "decimal") {
      yes = convertDecimalToAmerican(yesOdds);
      no = convertDecimalToAmerican(noOdds);
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/set-line`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        question,
        yes_odds: yes,
        no_odds: no,
        cutoff_time: new Date(cutoffTime).toISOString()
      })
    });

    const data = await res.json();
    if (res.ok) {
      setLineMessage({ text: "✅ Line set successfully", type: "success" });
      setShowLineAlert(true);
      setTimeout(() => setShowLineAlert(false), 1000);
    } else {
      setLineMessage({ text: data.error || "❌ Failed to set line", type: "error" });
      setShowLineAlert(true);
      setTimeout(() => setShowLineAlert(false), 1000);
    }
  };

  const handleResolveBet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!winningSide || (winningSide !== "YES" && winningSide !== "NO")) {
      alert("Please select a valid winning side (YES or NO)")
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const token = localStorage.getItem("token")
    if (!token) return router.push("/login");
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/resolve-bet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ date: today, winning_side: winningSide })
    })
    const data = await res.json()
    if (res.ok) {
      setResolveMessage({ text: `✅ Bet resolved: ${data.winning_side}`, type: "success" });
      fetchTodayBets();
      setShowResolveAlert(true);
      setTimeout(() => setShowResolveAlert(false), 1000);
    } else {
      setResolveMessage({ text: `❌ ${data.error || "Failed to resolve bet"}`, type: "error" });
      setShowResolveAlert(true);
      setTimeout(() => setShowResolveAlert(false), 1000);
    }
  }

  useEffect(() => {
    fetchTodayBets();
    const socket = io(`${process.env.NEXT_PUBLIC_BACKEND_URL}`);
    socket.on("bet_volume_updated", () => fetchTodayBets());
    return () => {
      socket.off("bet_volume_updated");
      //socket.disconnect();
    };
  }, []);

  const fetchTodayBets = async () => {
    const token = localStorage.getItem("token")
    if (!token) return router.push("/login")
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/bets`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (Array.isArray(data)) setBets(data);
  };

  const toggleSort = (column: keyof Bet) => {
    if (sortBy === column) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(column); setSortOrder("asc"); }
  };

  const sortedBets = [...bets].sort((a, b) => {
    if (!sortBy) return 0;
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (typeof aVal === "number" && typeof bVal === "number")
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    return sortOrder === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredBets = sortedBets.filter(bet =>
    (filterUsername === "" || bet.username.toLowerCase().includes(filterUsername.toLowerCase())) &&
    (filterSide === "" || bet.side === filterSide) &&
    (filterStatus === "" || bet.status === filterStatus)
  );

  const totalPages = Math.ceil(filteredBets.length / rowsPerPage);

  const paginatedBets = showAll
    ? filteredBets
    : filteredBets.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
        {/* Left buttons */}
        <div className="flex gap-3">
          <button onClick={() => router.push('/admin/users')} className="px-4 py-2 border rounded hover:bg-gray-100">
            User Balance
          </button>
          <button onClick={() => router.push('/admin/withdrawals')} className="px-4 py-2 border rounded hover:bg-gray-100">
            Withdrawals
          </button>
        </div>

        {/* Right buttons */}
        <div className="flex gap-3">
          <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 border rounded hover:bg-gray-100">
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-4 py-2 border rounded hover:bg-gray-100 text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      
      <h1 className="text-2xl font-semibold text-center mb-6">Admin Panel</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Set Line Card */}
        <div className="bg-white border rounded shadow-sm p-6 w-full">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-blue-600" /> Set Betting Line
          </h2>
            <div className="flex justify-center gap-2 mb-4">
              <button
                className={`px-4 py-2 rounded-l ${oddsFormat === 'american' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setOddsFormat("american")}
              >
                American
              </button>
              <button
                className={`px-4 py-2 rounded-r ${oddsFormat === 'decimal' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setOddsFormat("decimal")}
              >
                Decimal
              </button>
              </div>
              
            <form onSubmit={handleSetLine} className="space-y-4">
              <div>
                <label htmlFor="question" className="block text-sm font-medium mb-1 text-gray-700">
                  Today's Question
                </label>
                <input
                  id="question"
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring focus:ring-blue-200 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {["YES", "NO"].map(side => {
                const value = side === "YES" ? yesOdds : noOdds;
                const setter = side === "YES" ? setYesOdds : setNoOdds;
                const preview = oddsFormat === "american"
                  ? convertAmericanToDecimal(value)
                  : convertDecimalToAmerican(value);
                const invalid = oddsFormat === "decimal" && isInvalidDecimal(value);
                return (
                  <div key={side}>
                    <label className="block text-sm font-medium text-gray-700">{side} Odds ({oddsFormat})</label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                      required
                    />
                    {invalid ? (
                      <div className="flex items-center gap-1 text-sm text-red-600 mt-1">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span>Must be ≥ 1.01</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        {oddsFormat === "american" ? `Decimal: ${preview}` : `American: ${preview}`}
                      </p>
                    )}
                  </div>
                );
              })}
              </div>

              <div>
                <label htmlFor="cutoffTime" className="block text-sm font-medium mb-1 text-gray-700">
                  Cutoff Time (UTC)
                </label>
                <input
                  id="cutoffTime"
                  type="datetime-local"
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring focus:ring-blue-200 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 text-sm font-semibold rounded bg-gradient-to-r from-blue-600 to-blue-800 text-white hover:opacity-90 transition"
              >
                Set / Update Line
              </button>
            </form>
            {lineMessage.text && (
              <Alert
                type={lineMessage.type as "success" | "error"}
                message={lineMessage.text.replace(/^[✅❌]\s*/, "")}
                onDismiss={() => setLineMessage({ text: "", type: "" })}
              />
            )}
        </div>
          {/* Resolve Bet Card */}
          <div className="bg-white border rounded shadow-sm p-6 w-full">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-blue-600" /> Resolve Bet
          </h2>
            <form onSubmit={handleResolveBet} className="space-y-4">
              <div>
                <label htmlFor="winningSide" className="block text-sm font-medium mb-1 text-gray-700">
                  Winning Side
                </label>
                <select
                  id="winningSide"
                  value={winningSide}
                  onChange={(e) => setWinningSide(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:ring focus:ring-blue-200 text-sm"
                >
                  <option value="">Select winning side</option>
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 text-sm font-semibold rounded bg-gradient-to-r from-blue-600 to-blue-800 text-white hover:opacity-90 transition"
              >
                Resolve Bet
              </button>
            </form>
            {resolveMessage.text && (
              <Alert
                type={resolveMessage.type as "success" | "error"}
                message={resolveMessage.text.replace(/^[✅❌]\s*/, "")}
                onDismiss={() => setResolveMessage({ text: "", type: "" })}
              />
            )}
        </div>
      </div>
      {/* Bet History Section */}
      <div className="border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-blue-600" /> Bet History
        </h2>

        <div className="flex flex-wrap gap-3 items-end mb-4">
          <input type="text" placeholder="Filter by username" value={filterUsername} onChange={(e) => setFilterUsername(e.target.value)} className="flex-grow min-w-[100px] p-2 border border-gray-300 rounded text-sm" />
          <select value={filterSide} onChange={(e) => setFilterSide(e.target.value)} className="p-2 border border-gray-300 rounded text-sm">
            <option value="">All Sides</option>
            <option value="YES">YES</option>
            <option value="NO">NO</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="p-2 border border-gray-300 rounded text-sm">
            <option value="">All Statuses</option>
            <option value="WON">WON</option>
            <option value="LOST">LOST</option>
            <option value="PENDING">PENDING</option>
          </select>
          <button onClick={() => { setFilterUsername(''); setFilterSide(''); setFilterStatus(''); }} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-100 transition">
            <TrashIcon className="w-4 h-4" /> Clear
          </button>
        </div>

        <div className="overflow-x-auto max-h-[60vh] border rounded">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              <tr className="bg-gray-50 text-left text-sm text-gray-600 font-medium tracking-wide">
                <th className="p-2 cursor-pointer" onClick={() => toggleSort("username")}>Username {sortBy === "username" && (sortOrder === "asc" ? "▲" : "▼")}</th>
                <th className="p-2 cursor-pointer" onClick={() => toggleSort("amount")}>Bet Amount {sortBy === "amount" && (sortOrder === "asc" ? "▲" : "▼")}</th>
                <th className="p-2 cursor-pointer" onClick={() => toggleSort("side")}>Bet Side {sortBy === "side" && (sortOrder === "asc" ? "▲" : "▼")}</th>
                <th className="p-2 cursor-pointer" onClick={() => toggleSort("status")}>Status {sortBy === "status" && (sortOrder === "asc" ? "▲" : "▼")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBets.map((bet) => (
                <tr key={bet.id} className="bg-white border rounded shadow-sm hover:shadow-md transition-shadow">
                  <td className="p-2">{bet.username}</td>
                  <td className="p-2">{bet.amount} ETH</td>
                  <td className="p-2">{bet.side}</td>
                  <td className="p-2">{bet.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1 || showAll} className="px-4 py-1.5 text-sm rounded-full border transition disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed">
              ← Previous
            </button>
            <button onClick={() => setCurrentPage((p) => p < totalPages ? p + 1 : p)} disabled={currentPage >= totalPages || showAll} className="px-4 py-1.5 text-sm rounded-full border transition disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed">
              Next →
            </button>
          </div>
          <p className="text-sm text-gray-500">
          {showAll
                ? `All ${bets.length} bets`
                : `Page ${currentPage} of ${totalPages}`}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="jump" className="text-sm text-gray-600">Jump to:</label>
            <select
              id="jump"
              value={showAll ? "all" : currentPage}
              onChange={(e) => {
                if (e.target.value === "all") setShowAll(true);
                else { setCurrentPage(Number(e.target.value)); setShowAll(false); }
              }}
              className="text-sm p-1 border border-gray-300 rounded"
            >
              {Array.from({ length: totalPages }, (_, i) => (
                <option key={i + 1} value={i + 1}>Page {i + 1}</option>
              ))}
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </div>      
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />

    </div>
    
  )
}
