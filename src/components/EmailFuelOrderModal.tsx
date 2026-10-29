import { useState } from 'react';
import { X, Mail, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  buildFuelOrderPdf,
  fuelOrderFilename,
  fuelOrderNumber,
  fuelOrderPdfBase64,
  fuelOrderSubject,
  type FuelOrderPdfData,
} from '../lib/fuelOrderPdf';

interface EmailFuelOrderModalProps {
  order: FuelOrderPdfData;
  onClose: () => void;
  onSent: (message: string) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailFuelOrderModal({ order, onClose, onSent }: EmailFuelOrderModalProps) {
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    const recipients = to.split(',').map(e => e.trim()).filter(Boolean);
    if (recipients.length === 0) {
      setError('Enter at least one email address.');
      return;
    }
    if (!recipients.every(r => EMAIL_PATTERN.test(r))) {
      setError('One or more email addresses look invalid.');
      return;
    }

    try {
      setSending(true);
      setError('');
      const pdfContent = fuelOrderPdfBase64(buildFuelOrderPdf(order));
      const text = `Please find fuel order ${fuelOrderNumber(order)} attached as a PDF.\n\nPresent the order at the garage when refuelling.\n\nSent from MyFuelApp.net`;
      const { data, error: invokeError } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipients,
          subject: fuelOrderSubject(order),
          text,
          attachments: [{ filename: fuelOrderFilename(order), content: pdfContent }],
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      onSent(`Order emailed to ${recipients.join(', ')}.`);
      onClose();
    } catch (err: any) {
      console.error('Error emailing fuel order:', err);
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Email Order</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Attachment</p>
            <p className="text-sm text-gray-900">{fuelOrderFilename(order)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Order {fuelOrderNumber(order)} as a PDF</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recipient email address</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@example.com (comma-separate for multiple)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
            />
          </div>

          {error && (
            <div className="text-sm p-3 rounded-lg bg-red-50 text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !to.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending...' : 'Send PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
