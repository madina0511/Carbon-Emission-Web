import axios from "axios";
import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const API = "http://localhost:3002";
const api = axios.create({
  baseURL: API,
  headers: { "Cache-Control": "no-cache" },
});

interface SummaryData {
  totalEmission: number;
  total: number;
  scope1: number;
  scope2: number;
  scope3: number;
  aiInsight?: string;
  byMonth: {
    month: string;
    electricity: number;
    material: number;
    transport: number;
    total: number;
  }[];
  byCategory: {
    category: string;
    activityType: string;
    emission: number;
    scope: string;
  }[];
}
interface EmissionRow {
  id: string;
  date: string;
  activityType: string;
  description: string;
  amount: number;
  unit: string;
  emissionFactor: number;
  emission: number;
  scope: string;
}
interface UploadRecord {
  id: number;
  fileName: string;
  createdAt: string;
  _count?: { emissions: number };
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const COLORS: Record<string, string> = {
  전기: "#3b82f6",
  원소재: "#22c55e",
  운송: "#f59e0b",
};

// ── KPI Card ─────────────────────────────────────────────
function KpiCard({
  label,
  value,
  unit,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  unit: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#171717] rounded-2xl p-6 border border-[#2a2a2a] flex flex-col gap-1">
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-4xl font-bold mt-1 ${color ?? "text-white"}`}>
        {value}
      </p>
      <p className="text-gray-600 text-xs">{unit}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-[#2a2a2a] rounded-xl animate-pulse ${className}`} />
  );
}

// ── Empty State ───────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">📭</div>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

export default function Home() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [emissions, setEmissions] = useState<EmissionRow[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "files" | "chat">(
    "dashboard",
  );
  const [tableSearch, setTableSearch] = useState("");

  // AI
  const [aiInsight, setAiInsight] = useState<string>("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSummary();
    fetchEmissions();
    fetchUploads();
  }, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const fetchSummary = async (uploadId?: number) => {
    try {
      setLoading(true);
      const res = await api.get("/emissions/summary", {
        params: uploadId ? { uploadId } : {},
      });
      setSummary(res.data);
      fetchInsight(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInsight = async (data: SummaryData) => {
    if (!data.totalEmission) return;
    try {
      setInsightLoading(true);
      const lang = navigator.language.startsWith("ko") ? "Korean" : "English";
      const res = await api.post("/ai/insight", {
        totalEmission: data.totalEmission,
        scope1: data.scope1,
        scope2: data.scope2,
        scope3: data.scope3,
        byMonth: data.byMonth,
        byCategory: data.byCategory,
        language: lang,
      });
      setAiInsight(res.data.insight);
    } catch (error) {
      console.error(error);
    } finally {
      setInsightLoading(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || !summary) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await api.post("/ai/chat", {
        message: userMsg.content,
        context: {
          totalEmission: summary.totalEmission,
          scope2: summary.scope2,
          scope3: summary.scope3,
          byCategory: summary.byCategory.map((c) => ({
            category: c.category,
            emission: c.emission,
          })),
        },
        history: chatHistory.slice(-6),
      });
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: res.data.reply },
      ]);
    } catch {
      setChatHistory([
        ...newHistory,
        {
          role: "assistant",
          content: "오류가 발생했습니다. 다시 시도해주세요.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchEmissions = async (uploadId?: number) => {
    try {
      const res = await api.get("/emissions", {
        params: uploadId ? { uploadId } : {},
      });
      setEmissions(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUploads = async () => {
    try {
      const res = await api.get("/upload", { params: { _t: Date.now() } });
      setUploads(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploading(true);
      setUploadMsg(null);
      await api.post("/upload/excel", formData);
      setUploadMsg({ type: "success", text: "✅ Upload successful!" });
      await fetchSummary();
      await fetchEmissions();
      await fetchUploads();
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      setUploadMsg({
        type: "error",
        text: `❌ ${msg ?? "Upload failed. Please try again."}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSelectUpload = (uploadId: number) => {
    if (selectedUploadId === uploadId) {
      setSelectedUploadId(null);
      fetchSummary(); // ← barcha data
      fetchEmissions();
    } else {
      setSelectedUploadId(uploadId);
      fetchSummary(uploadId); // ← faqat shu fayl
      fetchEmissions(uploadId);
    }
    setActiveTab("files");
  };
  const deleteUpload = async (e: React.MouseEvent, uploadId: number) => {
    e.stopPropagation();
    if (!confirm("Delete this file?")) return;
    try {
      await api.delete(`/upload/${uploadId}`);
      if (selectedUploadId === uploadId) {
        setSelectedUploadId(null);
        fetchEmissions();
      }
      await fetchUploads();
      await fetchSummary();
    } catch {
      alert("Failed to delete");
    }
  };

  // CSV export
  const exportCSV = () => {
    const headers = [
      "날짜",
      "활동 유형",
      "설명",
      "량",
      "단위",
      "배출계수",
      "배출량(kgCO₂e)",
      "Scope",
    ];
    const rows = filteredEmissions.map((r) => [
      new Date(r.date).toISOString().slice(0, 7),
      r.activityType,
      r.description,
      r.amount,
      r.unit,
      r.emissionFactor,
      r.emission.toFixed(2),
      r.scope,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "emissions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleUpload(e.target.files[0]);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
  };

  const chartData =
    summary?.byMonth.map((m) => ({
      month: m.month.slice(5) + "월",
      전기: m.electricity,
      원소재: m.material,
      운송: m.transport,
    })) ?? [];

  const pieData =
    summary?.byCategory.map((c) => ({
      name: c.category,
      value: c.emission,
      activityType: c.activityType,
    })) ?? [];

  const filteredEmissions = emissions.filter((r) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      r.activityType.includes(q) ||
      r.description.includes(q) ||
      r.scope.toLowerCase().includes(q)
    );
  });

  const selectedUpload = uploads.find((u) => u.id === selectedUploadId);
  const card = "bg-[#171717] rounded-2xl p-6 border border-[#2a2a2a]";

  return (
    <div
      className={
        darkMode
          ? "min-h-screen bg-[#0f0f0f] text-white"
          : "min-h-screen bg-gray-50 text-gray-900"
      }>
      {/* Header */}
      <div className="border-b border-[#2a2a2a] px-10 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            🌿 Carbon Platform
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            CT-045 컴퓨터 화면 · PCF 탄소 발자국 대시보드
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="text-sm px-4 py-2 rounded-xl border border-[#2a2a2a] hover:bg-[#2a2a2a] transition">
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
          <span className="text-xs bg-green-900 text-green-400 px-3 py-1 rounded-full border border-green-800">
            ISO 14067
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-10 pt-6 flex gap-1 border-b border-[#2a2a2a]">
        {(["dashboard", "files", "chat"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            {tab === "dashboard"
              ? "📊 대시보드"
              : tab === "files"
                ? `📁 파일 (${uploads.length})`
                : "🤖 AI"}
          </button>
        ))}
      </div>

      <div className="px-10 py-8 space-y-6">
        {/* Upload zone */}
        {activeTab !== "chat" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              dragOver
                ? "border-blue-500 bg-blue-500/10"
                : "border-[#2a2a2a] bg-[#171717]"
            }`}>
            <p className="text-gray-400 mb-3 text-sm">
              Excel 파일을 드래그하거나 버튼을 클릭하세요
            </p>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 transition px-5 py-2 rounded-xl text-sm font-medium inline-block">
              {uploading ? "⏳ 업로드 중..." : "📂 파일 선택"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={onFileChange}
                disabled={uploading}
              />
            </label>
            {uploadMsg && (
              <p
                className={`mt-3 text-sm font-medium ${uploadMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>
                {uploadMsg.text}
              </p>
            )}
          </div>
        )}

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <>
            {/* Dashboard tab boshida */}
            {selectedUploadId && (
              <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">
                <span>
                  📁 필터:{" "}
                  {uploads.find((u) => u.id === selectedUploadId)?.fileName}
                </span>
                <button
                  onClick={() => {
                    setSelectedUploadId(null);
                    fetchSummary();
                    fetchEmissions();
                  }}
                  className="ml-auto hover:text-white transition">
                  ✕
                </button>
              </div>
            )}
            {/* KPI Cards */}
            {loading ? (
              <div className="grid grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-28" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-5">
                <KpiCard
                  label="총 탄소 배출량"
                  value={summary?.totalEmission?.toFixed(0) ?? 0}
                  unit="kgCO₂e"
                />
                <KpiCard
                  label="Scope 1 — 직접"
                  value={summary?.scope1?.toFixed(0) ?? 0}
                  unit="kgCO₂e · 직접 연소"
                  color="text-red-400"
                />
                <KpiCard
                  label="Scope 2 — 전기"
                  value={summary?.scope2?.toFixed(0) ?? 0}
                  unit="kgCO₂e · 간접 배출"
                  color="text-blue-400"
                />
                <KpiCard
                  label="Scope 3 — 공급망"
                  value={summary?.scope3?.toFixed(0) ?? 0}
                  unit="kgCO₂e · 원소재+운송"
                  color="text-yellow-400"
                />
              </div>
            )}

            {/* AI Insight */}
            <div className={card}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-300">
                  🤖 AI 인사이트
                </h2>
                <button
                  onClick={() => summary && fetchInsight(summary)}
                  disabled={insightLoading}
                  className="text-xs text-gray-500 hover:text-blue-400 transition disabled:opacity-40 border border-[#2a2a2a] px-3 py-1 rounded-lg">
                  {insightLoading ? "분석 중..." : "↻ 새로 고침"}
                </button>
              </div>
              {insightLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              ) : aiInsight ? (
                <p className="text-gray-300 text-sm leading-relaxed">
                  {aiInsight}
                </p>
              ) : (
                <p className="text-gray-600 text-sm">
                  데이터를 업로드하면 AI 인사이트가 자동으로 생성됩니다.
                </p>
              )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-3 gap-5">
              <div className={`col-span-2 ${card}`}>
                <h2 className="text-sm font-semibold text-gray-300 mb-5">
                  월별 배출량 추이
                </h2>
                {loading ? (
                  <Skeleton className="h-60" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: "#6b7280", fontSize: 11 }}
                        unit=" kg"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12, color: "#9ca3af" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="전기"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="원소재"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="운송"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className={card}>
                <h2 className="text-sm font-semibold text-gray-300 mb-5">
                  카테고리별 비중
                </h2>
                {loading ? (
                  <Skeleton className="h-60" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        innerRadius={55}
                        outerRadius={90}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}>
                        {pieData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={COLORS[entry.activityType] ?? "#888"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a1a",
                          border: "1px solid #2a2a2a",
                          borderRadius: 8,
                        }}
                        formatter={(value) => [
                          `${Number(value).toFixed(1)} kgCO₂e`,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Category table */}
            <div className={card}>
              <h2 className="text-sm font-semibold text-gray-300 mb-4">
                카테고리별 상세
              </h2>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8" />
                  ))}
                </div>
              ) : summary?.byCategory.length === 0 ? (
                <EmptyState message="업로드된 데이터가 없습니다." />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#2a2a2a] text-xs uppercase tracking-wider">
                      <th className="text-left pb-3">카테고리</th>
                      <th className="text-left pb-3">Scope</th>
                      <th className="text-right pb-3">배출량 (kgCO₂e)</th>
                      <th className="text-right pb-3">비중</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary?.byCategory
                      .sort((a, b) => b.emission - a.emission)
                      .map((row) => (
                        <tr
                          key={row.activityType}
                          className="border-b border-[#1e1e1e] hover:bg-[#1e1e1e] transition">
                          <td className="py-3 font-medium">{row.category}</td>
                          <td className="py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                row.scope === "Scope 1"
                                  ? "bg-red-900 text-red-400"
                                  : row.scope === "Scope 2"
                                    ? "bg-blue-900 text-blue-400"
                                    : "bg-yellow-900 text-yellow-400"
                              }`}>
                              {row.scope}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {row.emission.toFixed(1)}
                          </td>
                          <td className="py-3 text-right text-gray-400">
                            {summary?.totalEmission
                              ? (
                                  (row.emission / summary.totalEmission) *
                                  100
                                ).toFixed(1)
                              : 0}
                            %
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── FILES TAB ── */}
        {activeTab === "files" && (
          <div className="grid grid-cols-3 gap-5">
            {/* Upload list */}
            <div className={`${card} col-span-1 h-fit`}>
              <h2 className="text-sm font-semibold text-gray-300 mb-4">
                📁 업로드된 파일 ({uploads.length})
              </h2>
              {uploads.length === 0 ? (
                <EmptyState message="업로드된 파일이 없습니다." />
              ) : (
                <ul className="space-y-2">
                  {uploads.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => handleSelectUpload(u.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                          selectedUploadId === u.id
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1e1e1e] text-gray-300"
                        }`}>
                        <p className="font-medium truncate text-xs">
                          {u.fileName}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-gray-600">
                            {new Date(u.createdAt).toLocaleString("ko-KR")}
                          </p>
                          <div className="flex items-center gap-2">
                            {u._count && (
                              <span className="text-xs text-gray-600">
                                {u._count.emissions}건
                              </span>
                            )}
                            <span
                              role="button"
                              onClick={(e) => deleteUpload(e, u.id)}
                              className="text-xs text-red-500 hover:text-red-400 transition cursor-pointer">
                              🗑
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedUploadId && (
                <button
                  onClick={() => {
                    setSelectedUploadId(null);
                    fetchEmissions();
                  }}
                  className="mt-4 w-full text-xs text-gray-500 hover:text-gray-300 transition border border-[#2a2a2a] rounded-lg py-2">
                  ✕ 필터 해제
                </button>
              )}
            </div>

            {/* Emission table */}
            <div className={`${card} col-span-2`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-300">
                    📋 활동 데이터
                  </h2>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {selectedUpload
                      ? `파일: ${selectedUpload.fileName}`
                      : "전체 데이터"}{" "}
                    · {filteredEmissions.length}건
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <input
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="검색..."
                    className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500 transition w-32 placeholder-gray-600"
                  />
                  {/* CSV Export */}
                  <button
                    onClick={exportCSV}
                    className="text-xs bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] px-3 py-1.5 rounded-lg transition">
                    ⬇ CSV
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                {filteredEmissions.length === 0 ? (
                  <EmptyState
                    message={
                      tableSearch ? "검색 결과가 없습니다." : "데이터 없음"
                    }
                  />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#2a2a2a] text-xs uppercase tracking-wider">
                        <th className="text-left pb-3">날짜</th>
                        <th className="text-left pb-3">활동 유형</th>
                        <th className="text-left pb-3">설명</th>
                        <th className="text-right pb-3">량</th>
                        <th className="text-left pb-3">단위</th>
                        <th className="text-right pb-3">배출계수</th>
                        <th className="text-right pb-3">배출량</th>
                        <th className="text-left pb-3">Scope</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmissions.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-[#1e1e1e] hover:bg-[#1e1e1e] transition">
                          <td className="py-2 text-xs">
                            {new Date(row.date).toISOString().slice(0, 7)}
                          </td>
                          <td className="py-2 text-xs">{row.activityType}</td>
                          <td className="py-2 text-xs text-gray-400">
                            {row.description}
                          </td>
                          <td className="py-2 text-right text-xs">
                            {row.amount.toLocaleString()}
                          </td>
                          <td className="py-2 text-xs text-gray-400">
                            {row.unit}
                          </td>
                          <td className="py-2 text-right text-xs text-gray-400">
                            {row.emissionFactor}
                          </td>
                          <td className="py-2 text-right text-xs font-medium">
                            {row.emission.toFixed(2)}
                          </td>
                          <td className="py-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                row.scope === "Scope 1"
                                  ? "bg-red-900 text-red-400"
                                  : row.scope === "Scope 2"
                                    ? "bg-blue-900 text-blue-400"
                                    : "bg-yellow-900 text-yellow-400"
                              }`}>
                              {row.scope}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {activeTab === "chat" && (
          <div className={`${card} flex flex-col`} style={{ height: "68vh" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300">
                🤖 AI 탄소 어시스턴트
              </h2>
              {chatHistory.length > 0 && (
                <button
                  onClick={() => setChatHistory([])}
                  className="text-xs text-gray-600 hover:text-gray-400 transition border border-[#2a2a2a] px-3 py-1 rounded-lg">
                  대화 초기화
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4">
              {chatHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 text-sm">
                  <p className="text-4xl mb-4">🌿</p>
                  <p className="font-medium text-gray-400 mb-2">
                    탄소 배출에 대해 물어보세요
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
                    {[
                      "가장 많은 배출원은?",
                      "Scope 3 줄이는 방법?",
                      "이번 달 전기 배출량?",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setChatInput(q);
                        }}
                        className="text-xs border border-[#2a2a2a] px-3 py-1.5 rounded-full hover:border-blue-500 hover:text-blue-400 transition">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-[#2a2a2a] text-gray-200 rounded-bl-sm"
                    }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#2a2a2a] px-4 py-3 rounded-2xl rounded-bl-sm">
                    <span className="flex gap-1">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && sendChat()
                }
                placeholder={
                  summary
                    ? "메시지를 입력하세요..."
                    : "데이터를 먼저 업로드해주세요"
                }
                disabled={chatLoading || !summary}
                className="flex-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition disabled:opacity-40 placeholder-gray-600"
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim() || !summary}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition px-5 py-2.5 rounded-xl text-sm font-medium">
                전송
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
