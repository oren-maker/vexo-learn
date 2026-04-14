"use client";

export default function DownloadPdfButton({ sourceId }: { sourceId: string }) {
  function openPrint() {
    window.open(`/learn/sources/${sourceId}/print?auto=1`, "_blank", "noopener,noreferrer");
  }
  return (
    <button
      onClick={openPrint}
      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm border border-slate-700"
      title="פתח בחלון הדפסה ובחר Save as PDF"
    >
      📄 הורד PDF
    </button>
  );
}
