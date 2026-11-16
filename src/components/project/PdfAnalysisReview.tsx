import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Eye,
  FileText,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  Upload,
} from 'lucide-react';
import { validatePdfFile } from '../../domain/pdfValidation';
import {
  fetchBackendGoogleSession,
  subscribeGoogleSession,
} from '../../services/googleAuthService';
import { TeamDeckServiceError } from '../../services/teamDeckService';
import { PdfDocument } from '../../types';
import { InformationOriginType } from '../../types/pdfAnalysis';
import { GoogleSessionStatus } from '../../types/workspace';
import { formatDatePtBr } from '../../utils/formatters';
import { Card, CardHeader } from '../ui/Card';
import { GoogleAccountBar } from '../ui/GoogleAccountBar';

interface PdfAnalysisReviewProps {
  projectId: string;
  pdfDocument: PdfDocument | null;
  onAnalyzePdf: (projectId: string, file: File) => Promise<void>;
}

function formatPagesLabel(pages: number[]): string {
  if (!pages || pages.length === 0) return 'Página não informada';
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  return sorted.length === 1
    ? `Página ${sorted[0]}`
    : `Páginas ${sorted.join(', ')}`;
}

function OriginTextMarker({ origin }: { origin: InformationOriginType }) {
  if (origin === 'explicit') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Explícito no documento</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 whitespace-nowrap">
      <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Interpretação da IA</span>
    </span>
  );
}

export function PdfAnalysisReview({
  projectId,
  pdfDocument,
  onAnalyzePdf,
}: PdfAnalysisReviewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [googleSession, setGoogleSession] = useState<GoogleSessionStatus>({
    connected: false,
    email: null,
    displayName: null,
    expiresAt: null,
    isExpired: false,
    scopes: [],
  });

  useEffect(() => {
    const unsubscribe = subscribeGoogleSession(setGoogleSession);
    void fetchBackendGoogleSession();
    return () => unsubscribe();
  }, []);

  const needsAuth = !googleSession.connected || googleSession.isExpired;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    setSuccessMessage(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validation = validatePdfFile({
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      sizeBytes: file.size,
    });

    if (!validation.valid) {
      setSelectedFile(null);
      setLocalError(validation.error ?? 'Arquivo inválido.');
      return;
    }

    setSelectedFile(file);
  };

  const handleAnalyzeSubmit = async () => {
    if (needsAuth) {
      setLocalError(
        'Conecte (ou renove) sua conta Google antes de enviar o documento para análise.'
      );
      return;
    }

    if (!selectedFile) {
      setLocalError('Selecione um arquivo PDF válido antes de iniciar a análise.');
      return;
    }

    setLocalError(null);
    setSuccessMessage(null);
    setIsAnalyzing(true);

    try {
      await onAnalyzePdf(projectId, selectedFile);
      setSuccessMessage(
        'Documento PDF analisado com sucesso e resultados salvos no projeto.'
      );
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      if (
        error instanceof TeamDeckServiceError &&
        (error.code === 'GOOGLE_TOKEN_EXPIRED' ||
          error.code === 'GOOGLE_NOT_CONNECTED')
      ) {
        void fetchBackendGoogleSession();
      }
      setLocalError(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir o processamento do PDF.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analysis = pdfDocument?.analysis ?? null;

  return (
    <div className="space-y-6">
      <GoogleAccountBar
        purposeLabel="processar e analisar documentos PDF com segurança"
        compact
        onSessionChange={setGoogleSession}
      />

      {/* Bloco de envio e resumo básico do arquivo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card padding="md" className="lg:col-span-2 space-y-5">
          <CardHeader
            title="Documento PDF vinculado"
            subtitle="Arquivo acadêmico enviado para leitura e extração estruturada"
          />

          {pdfDocument ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {pdfDocument.fileName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {pdfDocument.fileSize} · {pdfDocument.pageCount} página(s) ·
                      Enviado em {formatDatePtBr(pdfDocument.uploadedAt)} por{' '}
                      {pdfDocument.uploadedBy}
                    </p>
                  </div>
                </div>
              </div>

              {!analysis && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Síntese inicial
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      {pdfDocument.summary}
                    </p>
                  </div>

                  {pdfDocument.extractedTopics.length > 0 && (
                    <div className="pt-4 border-t border-slate-200">
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">
                        Tópicos registrados
                      </h3>
                      <ul className="space-y-1.5">
                        {pdfDocument.extractedTopics.map((topic, index) => (
                          <li
                            key={topic}
                            className="flex items-start gap-2 text-sm text-slate-700"
                          >
                            <span className="text-xs font-semibold text-blue-700 tabular-nums mt-0.5">
                              {String(index + 1).padStart(2, '0')}.
                            </span>
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                    Envie o arquivo PDF pelo painel ao lado para gerar a análise completa estruturada por página.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center space-y-2">
              <FileText
                className="w-8 h-8 text-slate-400 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-slate-900">
                Nenhum documento PDF analisado neste projeto
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Envie o artigo, TCC ou relatório em PDF no painel de envio para extrair seções, argumentos, conceitos, elementos visuais e referências.
              </p>
            </div>
          )}
        </Card>

        {/* Upload e disparo da análise */}
        <Card padding="md" className="space-y-4">
          <CardHeader
            title="Enviar e analisar PDF"
            subtitle="Extração técnica estruturada via servidor"
          />

          <div className="p-5 border border-dashed border-blue-200 bg-blue-50/40 rounded-lg text-center space-y-3">
            <Upload
              className="w-6 h-6 text-blue-700 mx-auto"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">
                {selectedFile ? selectedFile.name : 'Selecione um arquivo .pdf'}
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB selecionado`
                  : 'Apenas application/pdf · Máximo 20 MB'}
              </p>
            </div>

            <label className="inline-flex items-center justify-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
              <span>{selectedFile ? 'Trocar arquivo' : 'Escolher arquivo PDF'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                disabled={isAnalyzing}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          {localError && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <button
            type="button"
            disabled={!selectedFile || isAnalyzing || needsAuth}
            onClick={() => void handleAnalyzeSubmit()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Analisando documento...</span>
              </>
            ) : (
              <span>Processar PDF e extrair análise</span>
            )}
          </button>
        </Card>
      </div>

      {/* Exibição completa da análise estruturada */}
      {analysis && (
        <div className="space-y-6">
          {/* Título, Objetivo Principal e Introdução */}
          <Card padding="md" className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="space-y-1">
                <p className="text-xs font-medium text-blue-700">
                  Revisão estruturada do documento ·{' '}
                  <span className="tabular-nums">
                    {formatPagesLabel(analysis.documentTitleSourcePages)}
                  </span>
                </p>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {analysis.documentTitle}
                </h3>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {analysis.sections.length} seção(ões) ·{' '}
                {analysis.visualElements.length} elemento(s) visual(is)
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  Objetivo principal
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                  <OriginTextMarker origin={analysis.mainObjective.sourceType} />
                  <span aria-hidden="true">·</span>
                  <span>{formatPagesLabel(analysis.mainObjective.sourcePages)}</span>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {analysis.mainObjective.text}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">
                  Introdução
                </h4>
                <span className="text-xs text-slate-500 tabular-nums">
                  {formatPagesLabel(analysis.introduction.sourcePages)}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {analysis.introduction.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-emerald-700">
                    Pontos explícitos na introdução
                  </p>
                  {analysis.introduction.explicitPoints.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum ponto listado.</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {analysis.introduction.explicitPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-600 mt-1">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-blue-700">
                    Observações interpretativas da IA
                  </p>
                  {analysis.introduction.aiNotes.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Nenhuma observação interpretativa adicional.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {analysis.introduction.aiNotes.map((note, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Seções e Subseções */}
          <Card padding="none" className="overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200">
              <CardHeader
                title="Seções e subseções identificadas"
                subtitle="Estrutura completa com ID, resumo, tópicos principais, elementos visuais e páginas de origem"
              />
            </div>

            <div className="divide-y divide-slate-200">
              {analysis.sections.map((section) => {
                const isSubsection = section.level > 1;
                return (
                  <div
                    key={section.id}
                    className={`p-5 sm:px-6 space-y-3 ${
                      isSubsection ? 'bg-slate-50/60 sm:pl-10' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                          <span className="font-mono font-medium text-blue-700">
                            {section.id}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {isSubsection
                              ? `Subseção (nível ${section.level})`
                              : 'Seção principal'}
                          </span>
                          {section.parentSectionId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">
                                pai: {section.parentSectionId}
                              </span>
                            </>
                          )}
                        </div>
                        <h4 className="text-base font-semibold text-slate-900">
                          {section.title}
                        </h4>
                      </div>

                      <span className="text-xs font-medium text-slate-600 tabular-nums shrink-0">
                        {formatPagesLabel(section.sourcePages)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">
                      {section.summary}
                    </p>

                    {section.mainTopics.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                          <span>Tópicos principais</span>
                        </p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs sm:text-sm text-slate-600">
                          {section.mainTopics.map((topic, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-700">–</span>
                              <span>{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {section.visualElements.length > 0 && (
                      <div className="pt-2 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                          <span>Elementos visuais nesta seção</span>
                        </p>
                        <div className="space-y-1">
                          {section.visualElements.map((vis) => (
                            <p key={vis.id} className="text-xs text-slate-600">
                              <span className="font-mono text-blue-700">
                                {vis.id}
                              </span>{' '}
                              · <span className="uppercase">{vis.type}</span> —{' '}
                              <span className="font-medium text-slate-800">
                                {vis.title}
                              </span>{' '}
                              ({formatPagesLabel(vis.sourcePages)}):{' '}
                              {vis.description}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Argumentos e Conceitos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card padding="none" className="overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <CardHeader
                  title="Principais argumentos"
                  subtitle="Teses defendidas e evidências apresentadas"
                />
              </div>
              {analysis.mainArguments.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Nenhum argumento explícito extraído.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {analysis.mainArguments.map((item, idx) => (
                    <div key={idx} className="p-5 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
                        <OriginTextMarker origin={item.sourceType} />
                        <span>{formatPagesLabel(item.sourcePages)}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.argument}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-600">
                        Evidência: {item.evidence}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <CardHeader
                  title="Conceitos importantes"
                  subtitle="Terminologia técnica preservada do documento"
                />
              </div>
              {analysis.keyConcepts.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Nenhum conceito técnico listado.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {analysis.keyConcepts.map((concept, idx) => (
                    <div key={idx} className="p-5 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                          <Lightbulb
                            className="w-4 h-4 text-blue-700 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{concept.term}</span>
                        </p>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {formatPagesLabel(concept.sourcePages)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {concept.definition}
                      </p>
                      <OriginTextMarker origin={concept.sourceType} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Exemplos do Autor e Elementos Visuais Consolidados */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card padding="none" className="overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <CardHeader
                  title="Exemplos apresentados pelo autor"
                  subtitle="Casos ilustrativos e aplicações citadas no texto"
                />
              </div>
              {analysis.authorExamples.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Nenhum exemplo específico identificado pelo autor no documento.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {analysis.authorExamples.map((example, idx) => (
                    <div key={idx} className="p-5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                          <MessageSquareQuote
                            className="w-4 h-4 text-blue-700 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{example.title}</span>
                        </p>
                        <span className="text-xs text-slate-500 tabular-nums shrink-0">
                          {formatPagesLabel(example.sourcePages)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {example.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <CardHeader
                  title="Imagens, tabelas, gráficos e diagramas"
                  subtitle="Elementos visuais mapeados com suas páginas de origem"
                />
              </div>
              {analysis.visualElements.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Nenhum elemento visual identificado no PDF.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {analysis.visualElements.map((vis) => (
                    <div key={vis.id} className="p-5 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-semibold text-blue-700">
                          {vis.id} · {vis.type.toUpperCase()}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {formatPagesLabel(vis.sourcePages)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {vis.title}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-600">
                        {vis.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Conclusões e Referências */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card padding="md" className="space-y-4">
              <CardHeader
                title="Conclusões"
                subtitle={formatPagesLabel(analysis.conclusions.sourcePages)}
              />

              <div className="space-y-3">
                <p className="text-xs font-semibold text-emerald-700">
                  Conclusões explícitas do documento
                </p>
                {analysis.conclusions.explicitConclusions.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhuma conclusão explícita registrada.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {analysis.conclusions.explicitConclusions.map((c, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-600 mt-1">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2">
                <p className="text-xs font-semibold text-blue-700">
                  Interpretações e sínteses da IA
                </p>
                {analysis.conclusions.aiInterpretations.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhuma interpretação adicional registrada.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {analysis.conclusions.aiInterpretations.map((c, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <CardHeader
                  title="Referências relevantes"
                  subtitle="Obras e fontes bibliográficas citadas no documento"
                />
              </div>
              {analysis.relevantReferences.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Nenhuma referência bibliográfica listada no documento.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {analysis.relevantReferences.map((ref, idx) => (
                    <div key={idx} className="p-5 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 flex items-start gap-1.5">
                          <BookMarked
                            className="w-4 h-4 text-blue-700 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{ref.reference}</span>
                        </p>
                        <span className="text-xs text-slate-500 tabular-nums shrink-0">
                          {formatPagesLabel(ref.sourcePages)}
                        </span>
                      </div>
                      {ref.context && (
                        <p className="text-xs text-slate-600 pl-5">
                          {ref.context}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Incertezas e Interpretações Explícitas da IA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card padding="none" className="overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <CardHeader
                  title="Incertezas e lacunas identificadas"
                  subtitle="Pontos ausentes, ilegíveis ou ambíguos no documento original"
                />
              </div>
              {analysis.uncertainties.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Nenhuma incerteza ou lacuna relevante apontada.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {analysis.uncertainties.map((unc, idx) => (
                    <div key={idx} className="p-5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                          <AlertTriangle
                            className="w-4 h-4 text-amber-600 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{unc.topic}</span>
                        </p>
                        <span className="text-xs text-slate-500 tabular-nums shrink-0">
                          {formatPagesLabel(unc.sourcePages)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600">
                        {unc.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="p-5 border-b border-slate-200">
                <CardHeader
                  title="Registro de interpretações da IA"
                  subtitle="Inferências e sínteses diferenciadas dos fatos literais"
                />
              </div>
              {analysis.aiInterpretations.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  Todas as declarações foram extraídas literalmente do texto.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {analysis.aiInterpretations.map((interp, idx) => (
                    <div key={idx} className="p-5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                          <HelpCircle
                            className="w-4 h-4 text-blue-700 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{interp.statement}</span>
                        </p>
                        <span className="text-xs text-slate-500 tabular-nums shrink-0">
                          {formatPagesLabel(interp.sourcePages)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600">
                        Base no texto: {interp.basis}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
