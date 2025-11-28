"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type EnrollmentCertificateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
};

// Create signature SVG as a data URL - Cody Cochran signature
const createSignatureSVG = (): string => {
  const svg = `
    <svg width="220" height="70" xmlns="http://www.w3.org/2000/svg">
      <!-- C -->
      <path d="M 15 35 Q 10 25, 15 20 Q 20 15, 25 18" 
            stroke="#1f2937" 
            stroke-width="2.8" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- o -->
      <path d="M 30 28 Q 35 25, 40 28 Q 35 32, 30 28" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- d -->
      <path d="M 45 20 L 45 38 Q 50 40, 55 38" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- y -->
      <path d="M 60 25 Q 65 30, 70 35 L 68 42" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- C -->
      <path d="M 85 35 Q 80 25, 85 20 Q 90 15, 95 18" 
            stroke="#1f2937" 
            stroke-width="2.8" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- o -->
      <path d="M 100 28 Q 105 25, 110 28 Q 105 32, 100 28" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- c -->
      <path d="M 115 28 Q 120 25, 125 28" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- h -->
      <path d="M 130 20 L 130 38 M 130 30 Q 135 28, 140 30 L 140 38" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- r -->
      <path d="M 145 30 L 145 38 M 145 30 Q 148 28, 152 30" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- a -->
      <path d="M 157 32 Q 162 30, 167 32 Q 162 35, 157 32 M 162 32 L 162 38" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- n -->
      <path d="M 172 30 L 172 38 M 172 30 Q 177 28, 182 30 L 182 38" 
            stroke="#1f2937" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      <!-- Underline flourish -->
      <path d="M 15 45 Q 50 48, 100 46 Q 150 44, 190 45" 
            stroke="#1f2937" 
            stroke-width="2" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            opacity="0.6"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export function EnrollmentCertificateModal({ isOpen, onClose, userName }: EnrollmentCertificateModalProps) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLImageElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const { user } = useAuth();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Generate signature on mount
      setSignatureDataUrl(createSignatureSVG());
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handlePrint = () => {
    if (certificateRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const printContent = certificateRef.current.innerHTML;
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Creator Collective Enrollment Certificate</title>
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                  background: white;
                  padding: 20px;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                }
                .certificate-container {
                  width: 8.5in;
                  height: 11in;
                  background: white;
                  border: 2px solid #e5e7eb;
                  position: relative;
                  padding: 60px 80px !important;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .certificate-border {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 6px;
                  height: 100%;
                  background: linear-gradient(to bottom, #dc2626, #991b1b);
                }
                .certificate-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 40px;
                }
                .certificate-logo {
                  display: flex;
                  align-items: center;
                  gap: 16px;
                }
                .certificate-logo img {
                  height: 60px;
                  width: auto;
                  object-fit: contain;
                }
                .logo-text {
                  font-size: 32px;
                  font-weight: bold;
                  color: #1f2937;
                }
                .certificate-contact {
                  text-align: right;
                  font-size: 12px;
                  color: #4b5563;
                  line-height: 1.6;
                }
                .certificate-contact svg {
                  width: 14px;
                  height: 14px;
                  display: inline-block;
                  vertical-align: middle;
                  margin-right: 4px;
                }
                .certificate-date {
                  text-align: right;
                  font-size: 14px;
                  color: #1f2937;
                  margin-top: 8px;
                }
                .certificate-body {
                  margin: 50px 0;
                }
                .certificate-greeting {
                  font-size: 14px;
                  color: #1f2937;
                  margin-bottom: 20px;
                }
                .certificate-text {
                  font-size: 15px;
                  color: #1f2937;
                  line-height: 1.8;
                  margin-bottom: 20px;
                }
                .certificate-name {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1f2937;
                  margin: 20px 0;
                  text-align: center;
                }
                .certificate-dates {
                  font-size: 15px;
                  color: #1f2937;
                  line-height: 1.8;
                  margin: 20px 0;
                }
                .certificate-dates strong {
                  font-weight: 700;
                }
                .certificate-signature {
                  margin-top: 60px;
                }
                .signature-image {
                  margin-top: 30px;
                  margin-bottom: 8px;
                  height: 50px;
                }
                .signature-name {
                  font-size: 16px;
                  font-weight: 600;
                  color: #1f2937;
                  margin-top: 4px;
                }
                .signature-title {
                  font-size: 14px;
                  color: #4b5563;
                  margin-top: 2px;
                }
                @media print {
                  body {
                    padding: 0;
                  }
                  .certificate-container {
                    box-shadow: none;
                    border: none;
                  }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    }
  };

  const handleDownload = async () => {
    if (!certificateRef.current || isGeneratingPDF) return;
    
    setIsGeneratingPDF(true);
    try {
      // Wait for images to load before generating PDF
      const imagePromises: Promise<void>[] = [];
      
      if (signatureRef.current && !signatureRef.current.complete) {
        imagePromises.push(new Promise((resolve) => {
          if (signatureRef.current) {
            signatureRef.current.onload = () => resolve();
            signatureRef.current.onerror = () => resolve();
          } else {
            resolve();
          }
        }));
      }
      
      if (logoRef.current && !logoRef.current.complete) {
        imagePromises.push(new Promise((resolve) => {
          if (logoRef.current) {
            logoRef.current.onload = () => resolve();
            logoRef.current.onerror = () => resolve();
          } else {
            resolve();
          }
        }));
      }
      
      await Promise.all(imagePromises);
      
      // Additional small delay to ensure all images are rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create a clone of the certificate element for PDF generation
      const element = certificateRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.offsetWidth,
        height: element.offsetHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [8.5, 11],
      });

      // Calculate dimensions to fit the page
      const pdfWidth = 8.5;
      const pdfHeight = 11;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / (imgWidth / 96), pdfHeight / (imgHeight / 96)); // 96 DPI
      const scaledWidth = (imgWidth / 96) * ratio;
      const scaledHeight = (imgHeight / 96) * ratio;
      const xOffset = (pdfWidth - scaledWidth) / 2;
      const yOffset = (pdfHeight - scaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, scaledWidth, scaledHeight);
      pdf.save(`Creator_Collective_Enrollment_Certificate_${userName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!isOpen) return null;

  const currentDate = new Date();
  const enrollmentDate = user?.metadata?.creationTime 
    ? new Date(user.metadata.creationTime)
    : currentDate;
  const endDate = new Date(enrollmentDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  return typeof window !== 'undefined' && createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div 
          className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl w-full max-w-4xl pointer-events-auto my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with controls */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-xl font-bold text-white truncate">Creator Collective Enrollment Certificate</h2>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* Page indicator */}
              <span className="text-xs sm:text-sm text-white/80 hidden sm:inline">1 / 1</span>
              
              {/* Zoom controls */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={handleDownload}
                  disabled={isGeneratingPDF}
                  className="p-2 text-white hover:bg-white/20 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Download"
                  title="Download PDF"
                >
                  {isGeneratingPDF ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={handlePrint}
                  className="p-2 text-white hover:bg-white/20 rounded transition"
                  aria-label="Print"
                  title="Print"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </button>
              </div>
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded transition"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Certificate Content */}
          <div className="bg-neutral-800 p-2 sm:p-4 md:p-8 overflow-auto max-h-[calc(100vh-200px)]">
            <div 
              ref={certificateRef}
              className="certificate-container bg-white mx-auto px-6 py-10 sm:px-12 sm:py-12 md:px-20 md:py-16"
              style={{
                width: '100%',
                maxWidth: '8.5in',
                minHeight: '11in',
                position: 'relative',
                border: '2px solid #e5e7eb',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
              }}
            >
              {/* Red border line */}
              <div 
                className="certificate-border"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '6px',
                  height: '100%',
                  background: 'linear-gradient(to bottom, #dc2626, #991b1b)',
                }}
              />

              {/* Header */}
              <div className="certificate-header flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-0 mb-8 sm:mb-10">
                <div className="certificate-logo flex items-center gap-3 sm:gap-4">
                  <img 
                    ref={logoRef}
                    src="/CC-Logo-Black.png"
                    alt="Course Creator Academy Logo"
                    className="flex-shrink-0"
                    style={{
                      height: '60px',
                      width: 'auto',
                      objectFit: 'contain',
                    }}
                    crossOrigin="anonymous"
                  />
                  <div 
                    className="logo-text"
                    style={{
                      fontSize: 'clamp(20px, 4vw, 32px)',
                      fontWeight: 'bold',
                      color: '#1f2937',
                    }}
                  >
                    Creator Collective
                  </div>
                </div>
                <div className="certificate-contact text-left sm:text-right text-xs sm:text-sm" style={{ color: '#4b5563', lineHeight: 1.6 }}>
                  <div className="mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-middle mr-1">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    info@coursecreatoracademy.org
                  </div>
                  <div 
                    className="certificate-date text-sm sm:text-base"
                    style={{
                      color: '#1f2937',
                    }}
                  >
                    {currentDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="certificate-body" style={{ margin: '50px 0' }}>
                <div 
                  className="certificate-greeting"
                  style={{
                    fontSize: '14px',
                    color: '#1f2937',
                    marginBottom: '20px',
                  }}
                >
                  To Whom It May Concern,
                </div>
                
                <div 
                  className="certificate-text"
                  style={{
                    fontSize: '15px',
                    color: '#1f2937',
                    lineHeight: 1.8,
                    marginBottom: '20px',
                  }}
                >
                  This is to verify that
                </div>

                <div 
                  className="certificate-name"
                  style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: '#1f2937',
                    margin: '20px 0',
                    textAlign: 'center',
                  }}
                >
                  {userName}
                </div>

                <div 
                  className="certificate-text"
                  style={{
                    fontSize: '15px',
                    color: '#1f2937',
                    lineHeight: 1.8,
                    marginBottom: '20px',
                  }}
                >
                  is enrolled as an online-learning student at Course Creator Academy - Creator Collective.
                </div>

                <div 
                  className="certificate-dates"
                  style={{
                    fontSize: '15px',
                    color: '#1f2937',
                    lineHeight: 1.8,
                    margin: '20px 0',
                  }}
                >
                  The beginning date of their enrollment is <strong>{formatDate(enrollmentDate)}</strong> and the ending date is <strong>{formatDate(endDate)}</strong>.
                </div>

                <div 
                  className="certificate-text"
                  style={{
                    fontSize: '15px',
                    color: '#1f2937',
                    lineHeight: 1.8,
                    marginTop: '20px',
                  }}
                >
                  Please feel free to contact us if you have any questions on this matter.
                </div>

                <div 
                  className="certificate-text"
                  style={{
                    fontSize: '15px',
                    color: '#1f2937',
                    lineHeight: 1.8,
                    marginTop: '20px',
                  }}
                >
                  Thank you for your support of this student's educational efforts at Course Creator Academy - Creator Collective.
                </div>
              </div>

              {/* Signature */}
              <div className="certificate-signature" style={{ marginTop: '60px' }}>
                <div 
                  className="certificate-text"
                  style={{
                    fontSize: '15px',
                    color: '#1f2937',
                    marginBottom: '20px',
                  }}
                >
                  Sincerely,
                </div>
                {signatureDataUrl && (
                  <img
                    ref={signatureRef}
                    src={signatureDataUrl}
                    alt="Cody Cochran Signature"
                    className="signature-image"
                    style={{
                      marginTop: '30px',
                      marginBottom: '8px',
                      height: '50px',
                      maxWidth: '200px',
                    }}
                  />
                )}
                <div 
                  className="signature-name"
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1f2937',
                    marginTop: '4px',
                  }}
                >
                  Cody Cochran
                </div>
                <div 
                  className="signature-title"
                  style={{
                    fontSize: '14px',
                    color: '#4b5563',
                    marginTop: '2px',
                  }}
                >
                  Founder, Course Creator Academy
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
