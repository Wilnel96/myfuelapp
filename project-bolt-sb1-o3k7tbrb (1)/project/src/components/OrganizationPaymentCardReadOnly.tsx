import React, { useState, useEffect } from 'react';
import { CreditCard, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentCard {
  id: string;
  card_brand: string;
  last_four_digits: string;
  card_nickname: string;
  card_type: string;
  is_default: boolean;
  created_at: string;
}

interface Props {
  organizationId: string;
  organizationName: string;
}

export function OrganizationPaymentCardReadOnly({ organizationId, organizationName }: Props) {
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<PaymentCard | null>(null);

  useEffect(() => {
    loadCard();
  }, [organizationId]);

  const loadCard = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('organization_payment_cards')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle();

      setCard(data);
    } catch (err) {
      console.error('Error loading card:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-xs text-gray-600">Loading card information...</p>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 mb-1">No Card Registered</p>
            <p className="text-amber-800">
              The client has not yet registered a payment card. The client's Main User or Secondary Main User must register the card through their Client Portal under Back Office → Payment Card.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <CreditCard className="w-8 h-8" />
          <Lock className="w-4 h-4" />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-blue-200 text-xs mb-1">Card Number</p>
            <p className="text-lg tracking-wider font-mono">
              •••• •••• •••• {card.last_four_digits}
            </p>
          </div>

          <div className="flex justify-between items-end">
            <div>
              <p className="text-blue-200 text-xs mb-1">Card Type</p>
              <p className="text-sm capitalize">{card.card_type}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{card.card_brand}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
        <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          <p className="font-medium mb-1">Read-Only View</p>
          <p>This is a read-only display for system administrators. Card details are encrypted and can only be managed by the client's Main Users through their Client Portal.</p>
        </div>
      </div>
    </div>
  );
}
