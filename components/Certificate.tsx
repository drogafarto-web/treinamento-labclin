import React from 'react';
import { createPortal } from 'react-dom';

interface CertificateProps {
  employeeName: string;
  moduleTitle: string;
  completionDate: string;
  score: number;
  durationHours: number;
  instructorName?: string;
  onClose: () => void;
}

export const Certificate: React.FC<CertificateProps> = ({
  employeeName,
  moduleTitle,
  completionDate,
  score,
  durationHours,
  instructorName = "Dra. Ana Silva",
  onClose
}) => {
  // Generate a safe hash/code for verification, handling UTF-8 characters safely
  const generateVerificationCode = () => {
    try {
      const rawString = `${employeeName}|${moduleTitle}|${completionDate}|${score}`;
      
      // Modern way to encode UTF-8 string to Base64 (Safe for acentos)
      const bytes = new TextEncoder().encode(rawString);
      const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
      const base64 = btoa(binString);
      
      return base64.substring(0, 16).toUpperCase();
    } catch (e) {
      console.error('Validation Code Generation Error:', e);
      return 'VALID-ERR-001';
    }
  };

  // Portal Content with Injection of Print Styles
  const modalContent = (
    <>
      <style>
        {`
          @media print {
            @page { 
              margin: 0; 
              size: landscape;
            }
            body {
              visibility: hidden;
            }
            #certificate-modal-root {
              visibility: visible;
              position: fixed;
              left: 0;
              top: 0;
              width: 100vw;
              height: 100vh;
              z-index: 99999;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            #certificate-modal-root * {
              visibility: visible;
            }
            /* Hide close buttons and action bars explicitly */
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
      <div 
        id="certificate-modal-root"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:fixed"
        onClick={onClose} // Close on backdrop click
      >
        <div 
          className="bg-white w-full max-w-4xl shadow-2xl relative print:shadow-none print:w-full print:max-w-none print:h-full flex flex-col"
          onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside content
        >
          {/* Top Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-full p-2 print:hidden z-10 no-print transition-colors shadow-sm"
            title="Fechar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Certificate Border Container - Enforce print colors */}
          <div className="p-2 bg-white print:p-0 print:h-full flex-grow">
            <div 
              className="border-[10px] border-double border-indigo-900 p-10 h-full flex flex-col items-center text-center bg-slate-50/30 print:border-indigo-900 print:bg-slate-50 print:h-full print:justify-center"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-900 rounded-full flex items-center justify-center text-white font-bold text-xl print:bg-indigo-900 print:text-white">L</div>
                  <h1 className="text-2xl font-serif font-bold text-indigo-900 uppercase tracking-widest">LabEdu Clínicas</h1>
                </div>
                <p className="text-xs text-indigo-800 uppercase tracking-wide">Excelência em Diagnóstico Laboratorial</p>
              </div>

              {/* Title */}
              <h2 className="text-5xl font-serif text-indigo-900 mb-8 mt-4 font-bold">Certificado de Conclusão</h2>

              {/* Content Body */}
              <div className="space-y-6 max-w-2xl">
                <p className="text-lg text-slate-600 font-serif italic">Certificamos que</p>
                
                <p className="text-4xl text-slate-900 font-serif font-medium border-b border-slate-300 pb-2 inline-block min-w-[300px]">
                  {employeeName}
                </p>

                <p className="text-lg text-slate-600 font-serif">
                  concluiu com êxito o módulo de treinamento de educação continuada:
                </p>

                <p className="text-2xl text-indigo-700 font-bold">
                  {moduleTitle}
                </p>

                <p className="text-slate-600">
                  Em conformidade com a <strong>RDC 978/2025</strong> da Anvisa.<br/>
                  Carga Horária: <strong>{durationHours} horas</strong> | Aproveitamento: <strong>{score}%</strong>
                </p>
              </div>

              {/* Footer / Signatures */}
              <div className="mt-20 w-full flex justify-around items-end">
                <div className="text-center">
                  <div className="w-48 border-t border-slate-800 mb-2"></div>
                  <p className="font-bold text-slate-800">{instructorName}</p>
                  <p className="text-xs text-slate-500 uppercase">Responsável Técnico</p>
                </div>
                
                <div className="text-center">
                  <p className="text-slate-800 font-medium mb-2">{completionDate}</p>
                  <div className="w-48 border-t border-slate-800 mb-2"></div>
                  <p className="text-xs text-slate-500 uppercase">Data de Emissão</p>
                </div>
              </div>

              {/* Verification Code */}
              <div className="mt-12 text-[10px] text-slate-400 font-mono">
                Código de Validação: {generateVerificationCode()}
              </div>

            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 print:hidden border-t border-slate-100 no-print rounded-b-lg">
            <button 
              onClick={onClose} 
              className="px-4 py-2 rounded text-slate-600 hover:bg-slate-200 font-medium transition-colors"
            >
              Voltar
            </button>
            <button 
              onClick={() => window.print()} 
              className="bg-indigo-600 text-white px-6 py-2 rounded shadow hover:bg-indigo-700 font-medium flex items-center gap-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // Render to Body using Portal
  return createPortal(modalContent, document.body);
};