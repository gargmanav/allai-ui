import { useState } from "react";
import { Sparkles, Camera, Shield, AlertTriangle, Wrench, ChevronDown, ChevronUp, Eye, Microscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Annotation {
  id: number;
  x: number;
  y: number;
  label: string;
  note: string;
}

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
      annotations?: Annotation[];
    };
  };
  mode: "tenant" | "contractor";
}

export function MayaPhotoAnalysis({ media, photoAnalysis, mode }: PhotoAnalysisProps) {
  const [expanded, setExpanded] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  return null;
}

export function PhotoAnalysisButton({ media, photoAnalysis }: {
  media: Array<{ id: string; url: string; type: string; caption?: string }>;
  photoAnalysis?: PhotoAnalysisProps["photoAnalysis"];
}) {
  const [open, setOpen] = useState(false);

  const images = media?.filter(m => m.type?.startsWith("image")) || [];
  const contractor = photoAnalysis?.contractor;

  const hasImages = images.length > 0;
  const hasPhotoAnalysis = hasImages && (contractor?.summary || (contractor?.annotations && contractor.annotations.length > 0));
  const hasTechNotes = contractor?.technicalNotes || (contractor?.materialsNeeded && contractor.materialsNeeded.length > 0) || contractor?.codeCompliance;

  if (!hasImages && !contractor && !hasTechNotes) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 px-2.5 text-violet-600 hover:text-violet-700 hover:bg-violet-50 gap-1.5 text-xs font-medium"
      >
        <Microscope className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Maya Details</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[85vh]" aria-describedby={undefined}>
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-violet-100 bg-gradient-to-r from-violet-50/80 to-white">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              Maya Analysis
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(85vh-80px)]">
            <div className="px-5 pb-5 space-y-5">

              {hasImages && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">
                      {hasPhotoAnalysis ? "Photo Analysis" : "Attached Photos"}
                    </span>
                  </div>

                  {hasPhotoAnalysis ? (
                    <AnnotatedImage
                      src={images[0]?.url}
                      annotations={contractor?.annotations || []}
                    />
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                      <img src={images[0]?.url} alt="Attached photo" className="w-full h-auto max-h-[400px] object-contain" />
                    </div>
                  )}

                  {contractor?.summary && (
                    <div className="space-y-1">
                      <p className="text-sm text-slate-700 leading-relaxed">{contractor.summary}</p>
                    </div>
                  )}

                  {contractor?.annotations && contractor.annotations.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Findings</span>
                      <div className="space-y-2">
                        {contractor.annotations.map((a) => (
                          <div key={a.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {a.id}
                            </span>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-700 block">{a.label}</span>
                              <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{a.note}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pt-2 border-t">
                      <span className="text-xs text-slate-400 self-center shrink-0">More:</span>
                      {images.slice(1).map((m) => (
                        <img key={m.id} src={m.url} alt={m.caption || "Photo"} className="w-14 h-14 rounded-lg object-cover border shrink-0" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {hasImages && hasTechNotes && (
                <div className="border-t border-slate-200" />
              )}

              {hasTechNotes && (
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Technical Notes</span>
                  </div>

                  {contractor?.technicalNotes && (
                    <p className="text-sm text-slate-700 leading-relaxed">{contractor.technicalNotes}</p>
                  )}

                  {contractor?.materialsNeeded && contractor.materialsNeeded.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Materials Needed</span>
                      <div className="flex flex-wrap gap-1.5">
                        {contractor.materialsNeeded.map((item, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-white border-slate-200 text-slate-600 py-1">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {contractor?.codeCompliance && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-amber-700 block mb-0.5">Code Compliance</span>
                        <p className="text-sm text-amber-600 leading-relaxed">{contractor.codeCompliance}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnnotatedImage({ src, annotations }: { src: string; annotations: Annotation[] }) {
  const [activeAnnotation, setActiveAnnotation] = useState<number | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!src) return null;

  const active = annotations.find(a => a.id === activeAnnotation);

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border border-violet-200 bg-slate-100">
        <img
          src={src}
          alt="Analyzed photo"
          className="w-full h-auto max-h-[400px] object-contain rounded-lg"
          onLoad={() => setImgLoaded(true)}
        />

        {imgLoaded && annotations.map((a) => (
          <button
            key={a.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
            onClick={() => setActiveAnnotation(activeAnnotation === a.id ? null : a.id)}
            onMouseEnter={() => setActiveAnnotation(a.id)}
            onMouseLeave={() => setActiveAnnotation(null)}
          >
            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold shadow-lg ring-2 ring-white/80 transition-all cursor-pointer ${
              activeAnnotation === a.id 
                ? "bg-red-600 scale-125" 
                : "bg-red-500/90 hover:bg-red-600 hover:scale-110 animate-pulse hover:animate-none"
            }`}>
              {a.id}
            </span>
          </button>
        ))}

        {annotations.length > 0 && imgLoaded && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-violet-300" />
            <span className="text-[10px] text-white/90 font-medium">{annotations.length} issue{annotations.length !== 1 ? 's' : ''} found</span>
          </div>
        )}
      </div>

      {active && (
        <div className="rounded-lg bg-slate-900 text-white p-3 shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {active.id}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-violet-300">{active.label}</p>
              <p className="text-xs leading-relaxed text-slate-300 mt-0.5">{active.note}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageLightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <Dialog open={!!url} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-2 bg-black/95 border-none" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Photo viewer</DialogTitle>
        <img src={url} alt="Full size" className="w-full h-auto max-h-[80vh] object-contain rounded" />
      </DialogContent>
    </Dialog>
  );
}
