import axios from "axios";
import { useEffect, useState } from "react";
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

const COLORS: Record<string, string> = {
  전기: "#3b82f6",
  원소재: "#22c55e",
  운송: "#f59e0b",
};

export default function Home() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [emissions, setEmissions] = useState<EmissionRow[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "files">(
    "dashboard",
  );

  useEffect(() => {
    fetchSummary();
    fetchEmissions();
    fetchUploads();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get("/emissions/summary");
      setSummary(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
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
      const res = await api.get("/upload", {
        params: { _t: Date.now() },
      });
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
      setUploadMsg("");
      await api.post("/upload/excel", formData);
      setUploadMsg("✅ Upload successful!");
      await fetchSummary();
      await fetchEmissions();
      await fetchUploads();
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      setUploadMsg(`❌ ${msg ?? "Upload failed. Please try again."}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectUpload = (uploadId: number) => {
    if (selectedUploadId === uploadId) {
      setSelectedUploadId(null);
      fetchEmissions();
    } else {
      setSelectedUploadId(uploadId);
      fetchEmissions(uploadId);
    }
    setActiveTab("files");
  };

  const deleteUpload = async (e: React.MouseEvent, uploadId: number) => {
    e.stopPropagation(); // fayl tanlanmasin
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      await api.delete(`/upload/${uploadId}`);
      if (selectedUploadId === uploadId) {
        setSelectedUploadId(null);
        fetchEmissions();
      }
      await fetchUploads();
      await fetchSummary();
    } catch {
      alert("There was an error deleting the file. Please try again.");
    }
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
        <div className="flex items-center gap-4">
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
      <div className="px-10 pt-6 flex gap-2 border-b border-[#2a2a2a]">
        {(["dashboard", "files"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            {tab === "dashboard"
              ? "📊 대시보드"
              : `📁 업로드 파일 (${uploads.length})`}
          </button>
        ))}
      </div>

      <div className="px-10 py-8 space-y-8">
        {/* Upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            dragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-[#2a2a2a] bg-[#171717]"
          }`}>
          <p className="text-gray-400 mb-4 text-sm">
            Excel 파일을 드래그하거나 버튼을 클릭하세요
          </p>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 transition px-6 py-2.5 rounded-xl text-sm font-medium">
            {uploading ? "업로드 중..." : "📂 파일 선택"}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onFileChange}
              disabled={uploading}
            />
          </label>
          {uploadMsg && <p className="mt-3 text-sm">{uploadMsg}</p>}
        </div>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === "dashboard" && (
          <>
            {loading ? (
              <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-[#171717] rounded-2xl p-6 border border-[#2a2a2a] animate-pulse h-28"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                <div className={card}>
                  <p className="text-gray-500 text-sm mb-2">총 탄소 배출량</p>
                  <p className="text-4xl font-bold">
                    {summary?.totalEmission?.toFixed(0) ?? 0}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">kgCO₂e</p>
                </div>
                <div className={card}>
                  <p className="text-gray-500 text-sm mb-2">Scope 2 — 전기</p>
                  <p className="text-4xl font-bold text-blue-400">
                    {summary?.scope2.toFixed(0) ?? 0}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    kgCO₂e · 간접 배출
                  </p>
                </div>
                <div className={card}>
                  <p className="text-gray-500 text-sm mb-2">Scope 3 — 공급망</p>
                  <p className="text-4xl font-bold text-yellow-400">
                    {summary?.scope3.toFixed(0) ?? 0}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    kgCO₂e · 원소재 + 운송
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-6">
              <div className={`col-span-2 ${card}`}>
                <h2 className="text-base font-semibold mb-6">
                  월별 배출량 추이
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 12 }}
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
                    <Line
                      type="monotone"
                      dataKey="전기"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="원소재"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="운송"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className={card}>
                <h2 className="text-base font-semibold mb-6">
                  카테고리별 비중
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      innerRadius={60}
                      outerRadius={100}
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
              </div>
            </div>

            {summary?.aiInsight && (
              <div className={card}>
                <h2 className="text-base font-semibold mb-3">🤖 AI 인사이트</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {summary.aiInsight}
                </p>
              </div>
            )}

            <div className={card}>
              <h2 className="text-base font-semibold mb-4">카테고리별 상세</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-[#2a2a2a]">
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
                        className="border-b border-[#1e1e1e]">
                        <td className="py-3 font-medium">{row.category}</td>
                        <td className="py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              row.scope === "Scope 2"
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
            </div>
          </>
        )}

        {/* ── FILES TAB ── */}
        {activeTab === "files" && (
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Upload list */}
            <div className={`${card} col-span-1 h-fit`}>
              <h2 className="text-base font-semibold mb-4">
                📁 업로드된 파일 ({uploads.length})
              </h2>
              {uploads.length === 0 ? (
                <p className="text-gray-500 text-sm">업로드된 파일 없음</p>
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
                        <p className="font-medium truncate">{u.fileName}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-gray-500">
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
                  className="mt-4 w-full text-xs text-gray-500 hover:text-gray-300 transition">
                  ✕ 필터 해제 (전체 보기)
                </button>
              )}
            </div>

            {/* Right: Emission rows */}
            <div className={`${card} col-span-2`}>
              <h2 className="text-base font-semibold mb-1">📋 활동 데이터</h2>
              <p className="text-xs text-gray-500 mb-4">
                {selectedUpload
                  ? `파일: ${selectedUpload.fileName}`
                  : "전체 데이터"}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#2a2a2a]">
                      <th className="text-left pb-3">날짜</th>
                      <th className="text-left pb-3">활동 유형</th>
                      <th className="text-left pb-3">설명</th>
                      <th className="text-right pb-3">량</th>
                      <th className="text-left pb-3">단위</th>
                      <th className="text-right pb-3">배출계수</th>
                      <th className="text-right pb-3">배출량 (kgCO₂e)</th>
                      <th className="text-left pb-3">Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emissions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-8 text-center text-gray-500">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      emissions.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-[#1e1e1e] hover:bg-[#1e1e1e] transition">
                          <td className="py-2">
                            {new Date(row.date).toISOString().slice(0, 7)}
                          </td>
                          <td className="py-2">{row.activityType}</td>
                          <td className="py-2 text-gray-400">
                            {row.description}
                          </td>
                          <td className="py-2 text-right">
                            {row.amount.toLocaleString()}
                          </td>
                          <td className="py-2 text-gray-400">{row.unit}</td>
                          <td className="py-2 text-right text-gray-400">
                            {row.emissionFactor}
                          </td>
                          <td className="py-2 text-right font-medium">
                            {row.emission.toFixed(2)}
                          </td>
                          <td className="py-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                row.scope === "Scope 2"
                                  ? "bg-blue-900 text-blue-400"
                                  : "bg-yellow-900 text-yellow-400"
                              }`}>
                              {row.scope}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
