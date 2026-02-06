import { useState } from "react";
import { Sparkles, Camera, Shield, AlertTriangle, Wrench, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PhotoAnalysisProps {
  media: Array<{ id: string; url: string; type: string; caption?: string }>;
  photoAnalysis?: {
    tenant?: {
      summary: string;
      advice: string;
      safetyLevel?: string;
    };
    contractor?: {
      summary: string;
      technicalNotes: string;
      materialsNeeded?: string[];
      codeCompliance?: string;
    };
  };
  mode: "tenant" | "contractor";
}

export function MayaPhotoAnalysis({ media, photoAnalysis, mode }: PhotoAnalysisProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const images = media.filter(m => m.type?.startsWith("image"));
  if (images.length === 0) return null;

  const analysis = mode === "tenant" ? photoAnalysis?.tenant : photoAnalysis?.contractor;
  if (!analysis) {
    return (
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Attached Photos</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((m) => (
            <button key={m.id} onClick={() => setLightboxUrl(m.url)} className="shrink-0 group">
              <img src={m.url} alt={m.caption || "Attachment"} className="w-24 h-24 rounded-lg object-cover border group-hover:ring-2 ring-violet-300 transition-all" />
            </button>
          ))}
        </div>
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      </div>
    );
  }

  if (mode === "tenant") {
    return (
      <div className="mt-4 pt-4 border-t">
        <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                <Eye className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-violet-700">Maya looked at your photo</span>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-violet-400" /> : <ChevronDown className="h-4 w-4 text-violet-400" />}
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3">
              <div className="flex gap-3">
                <button onClick={() => setLightboxUrl(images[0]?.url)} className="shrink-0 group">
                  <img
                    src={images[0]?.url}
                    alt="Your uploaded photo"
                    className="w-20 h-20 rounded-lg object-cover border-2 border-violet-200 group-hover:border-violet-400 transition-colors shadow-sm"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {(analysis as any).summary}
                  </p>
                </div>
              </div>

              {(analysis as any).advice && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <Shield className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-700 leading-relaxed">{(analysis as any).advice}</p>
                </div>
              )}

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pt-1">
                  {images.slice(1).map((m) => (
                    <button key={m.id} onClick={() => setLightboxUrl(m.url)} className="shrink-0 group">
                      <img src={m.url} alt={m.caption || "Photo"} className="w-16 h-16 rounded-lg object-cover border group-hover:ring-2 ring-violet-300 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      </div>
    );
  }

  const contractorAnalysis = photoAnalysis?.contractor;
  return (
    <div className="mt-4 pt-4 border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
            <Camera className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Photo Analysis</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-violet-400" /> : <ChevronDown className="h-4 w-4 text-violet-400" />}
      </button>

      {expanded && (
        <div className="rounded-lg border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white overflow-hidden">
          <div className="p-3 space-y-3">
            <div className="flex gap-3">
              <button onClick={() => setLightboxUrl(images[0]?.url)} className="shrink-0 group">
                <img
                  src={images[0]?.url}
                  alt="Submitted photo"
                  className="w-24 h-24 rounded-lg object-cover border-2 border-violet-200 group-hover:border-violet-400 transition-colors shadow-sm"
                />
              </button>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-violet-500" />
                  <span className="text-xs font-medium text-violet-600">Visual Assessment</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {contractorAnalysis?.summary}
                </p>
              </div>
            </div>

            {contractorAnalysis?.technicalNotes && (
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Wrench className="h-3 w-3 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">Technical Notes</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{contractorAnalysis.technicalNotes}</p>
              </div>
            )}

            {contractorAnalysis?.materialsNeeded && contractorAnalysis.materialsNeeded.length > 0 && (
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-100">
                <span className="text-xs font-medium text-slate-600 block mb-1.5">Materials Needed</span>
                <div className="flex flex-wrap gap-1.5">
                  {contractorAnalysis.materialsNeeded.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-[11px] bg-white border-slate-200 text-slate-600">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {contractorAnalysis?.codeCompliance && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50/80 border border-amber-100">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-medium text-amber-700 block mb-0.5">Code Compliance</span>
                  <p className="text-xs text-amber-600 leading-relaxed">{contractorAnalysis.codeCompliance}</p>
                </div>
              </div>
            )}

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pt-1 border-t border-violet-100">
                <span className="text-xs text-slate-400 self-center shrink-0">More photos:</span>
                {images.slice(1).map((m) => (
                  <button key={m.id} onClick={() => setLightboxUrl(m.url)} className="shrink-0 group">
                    <img src={m.url} alt={m.caption || "Photo"} className="w-16 h-16 rounded-lg object-cover border group-hover:ring-2 ring-violet-300 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}

function ImageLightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <Dialog open={!!url} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-2 bg-black/95 border-none">
        <img src={url} alt="Full size" className="w-full h-auto max-h-[80vh] object-contain rounded" />
      </DialogContent>
    </Dialog>
  );
}
