import { useState } from 'react';
import { UserPlus, Pencil, Trash2, Star, X, Check, Shield, ChevronDown, ChevronUp } from 'lucide-react';

export interface GarageContactPerson {
  name: string;
  surname: string;
  email: string;
  phone: string;
  mobile_phone: string;
  is_primary: boolean;
  // Permissions
  can_change_account_numbers: boolean;
  can_edit_client_info: boolean;
  can_view_invoices: boolean;
  can_create_invoices: boolean;
  can_manage_statements: boolean;
  can_manage_payments: boolean;
  can_add_clients: boolean;
  can_view_reports: boolean;
}

const EMPTY_CONTACT: GarageContactPerson = {
  name: '',
  surname: '',
  email: '',
  phone: '',
  mobile_phone: '',
  is_primary: false,
  can_change_account_numbers: false,
  can_edit_client_info: false,
  can_view_invoices: true,
  can_create_invoices: false,
  can_manage_statements: false,
  can_manage_payments: false,
  can_add_clients: false,
  can_view_reports: true,
};

const MAIN_USER_PERMISSIONS: Partial<GarageContactPerson> = {
  can_change_account_numbers: true,
  can_edit_client_info: true,
  can_view_invoices: true,
  can_create_invoices: true,
  can_manage_statements: true,
  can_manage_payments: true,
  can_add_clients: true,
  can_view_reports: true,
};

interface Permission {
  key: keyof GarageContactPerson;
  label: string;
  description: string;
}

const PERMISSIONS: Permission[] = [
  { key: 'can_view_invoices', label: 'View Fuel Invoices', description: 'View client fuel invoices' },
  { key: 'can_view_reports', label: 'View Reports', description: 'Access reports and statements' },
  { key: 'can_manage_statements', label: 'Create Statements', description: 'Generate and manage client statements' },
  { key: 'can_manage_payments', label: 'Manage Payments', description: 'Record and view client payments' },
  { key: 'can_create_invoices', label: 'Create Fee Invoices', description: 'Generate monthly management fee invoices' },
  { key: 'can_edit_client_info', label: 'Edit Client Information', description: 'Edit managed client organisation details' },
  { key: 'can_add_clients', label: 'Add / Link Clients', description: 'Add new clients or link existing ones' },
  { key: 'can_change_account_numbers', label: 'Change Account Numbers', description: 'Modify client account numbers (high-risk — main user only recommended)' },
];

interface GarageContactManagementProps {
  contacts: GarageContactPerson[];
  onUpdate: (contacts: GarageContactPerson[]) => void;
}

function PermissionsGrid({
  contact,
  onChange,
  isPrimary,
}: {
  contact: GarageContactPerson;
  onChange: (updates: Partial<GarageContactPerson>) => void;
  isPrimary: boolean;
}) {
  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <Shield className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Permissions</span>
        {isPrimary && (
          <span className="ml-auto text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Primary user — all permissions granted
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {PERMISSIONS.map(({ key, label, description }) => {
          const checked = !!contact[key];
          const disabled = isPrimary;
          return (
            <label
              key={key}
              className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={e => onChange({ [key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                {key === 'can_change_account_numbers' && (
                  <p className="text-xs text-red-600 mt-0.5 font-medium">
                    Warning: changing an account number can cause fuel transactions to be charged to the wrong client.
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ContactForm({
  contact,
  onChange,
  onSave,
  onCancel,
  saveLabel,
  isPrimary,
}: {
  contact: GarageContactPerson;
  onChange: (updates: Partial<GarageContactPerson>) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  isPrimary: boolean;
}) {
  const [showPerms, setShowPerms] = useState(true);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input
            type="text"
            value={contact.name}
            onChange={e => onChange({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="First name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Surname *</label>
          <input
            type="text"
            value={contact.surname}
            onChange={e => onChange({ surname: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Last name"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <input
          type="email"
          value={contact.email}
          onChange={e => onChange({ email: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="email@example.com"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
          <input
            type="tel"
            value={contact.mobile_phone}
            onChange={e => onChange({ mobile_phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="0821234567"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Office Number</label>
          <input
            type="tel"
            value={contact.phone}
            onChange={e => onChange({ phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="0123456789"
          />
        </div>
      </div>

      {/* Permissions toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowPerms(v => !v)}
          className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
        >
          <Shield className="w-4 h-4" />
          {showPerms ? 'Hide' : 'Show'} Permissions
          {showPerms ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showPerms && (
          <PermissionsGrid contact={contact} onChange={onChange} isPrimary={isPrimary} />
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Check className="w-4 h-4" />
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function GarageContactManagement({ contacts, onUpdate }: GarageContactManagementProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContact, setEditContact] = useState<GarageContactPerson | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newContact, setNewContact] = useState<GarageContactPerson>({ ...EMPTY_CONTACT });

  const normalise = (c: GarageContactPerson): GarageContactPerson => ({
    ...EMPTY_CONTACT,
    ...c,
  });

  const validate = (c: GarageContactPerson, currentIndex?: number): string | null => {
    if (!c.name.trim() || !c.surname.trim()) return 'First name and surname are required.';
    if (!c.email.trim()) return 'Email is required.';
    const dupe = contacts.some((x, i) =>
      i !== currentIndex && x.email.toLowerCase() === c.email.toLowerCase()
    );
    if (dupe) return 'A contact with this email already exists.';
    return null;
  };

  const handleAdd = () => {
    const err = validate(newContact);
    if (err) { alert(err); return; }
    const isFirst = contacts.length === 0;
    const toAdd = normalise({
      ...newContact,
      is_primary: isFirst || newContact.is_primary,
      ...(isFirst || newContact.is_primary ? MAIN_USER_PERMISSIONS : {}),
    });
    onUpdate([...contacts, toAdd]);
    setNewContact({ ...EMPTY_CONTACT });
    setAddingNew(false);
  };

  const handleSaveEdit = (index: number) => {
    if (!editContact) return;
    const err = validate(editContact, index);
    if (err) { alert(err); return; }
    const updated = [...contacts];
    updated[index] = normalise(editContact);
    onUpdate(updated);
    setEditingIndex(null);
    setEditContact(null);
  };

  const handleDelete = (index: number) => {
    if (contacts.length === 1) {
      alert('Cannot remove the last contact person. At least one is required.');
      return;
    }
    if (!confirm('Remove this contact person?')) return;
    const updated = contacts.filter((_, i) => i !== index);
    if (contacts[index].is_primary && updated.length > 0) {
      updated[0] = { ...updated[0], is_primary: true, ...MAIN_USER_PERMISSIONS };
    }
    onUpdate(updated);
  };

  const handleSetPrimary = (index: number) => {
    const updated = contacts.map((c, i) => ({
      ...normalise(c),
      is_primary: i === index,
      ...(i === index ? MAIN_USER_PERMISSIONS : {}),
    }));
    onUpdate(updated);
  };

  const startEdit = (index: number) => {
    setEditContact(normalise({ ...contacts[index] }));
    setEditingIndex(index);
  };

  const permissionSummary = (c: GarageContactPerson) => {
    const granted = PERMISSIONS.filter(p => !!c[p.key]).map(p => p.label);
    if (granted.length === PERMISSIONS.length) return 'Full access';
    if (granted.length === 0) return 'No permissions';
    if (granted.length <= 3) return granted.join(', ');
    return `${granted.slice(0, 2).join(', ')} +${granted.length - 2} more`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900">Contact Persons &amp; Users</h2>
        <button
          type="button"
          onClick={() => { setAddingNew(true); setNewContact({ ...EMPTY_CONTACT }); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Add Person
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Manage garage contacts and their portal access permissions. The primary contact has full access. Assign specific permissions to other users as needed.
      </p>

      {/* Add modal */}
      {addingNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900">Add Contact Person / User</h3>
              <button
                type="button"
                onClick={() => { setAddingNew(false); setNewContact({ ...EMPTY_CONTACT }); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <ContactForm
                contact={newContact}
                onChange={updates => setNewContact(c => ({ ...c, ...updates }))}
                onSave={handleAdd}
                onCancel={() => { setAddingNew(false); setNewContact({ ...EMPTY_CONTACT }); }}
                saveLabel="Add Person"
                isPrimary={contacts.length === 0}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {contacts.map((contact, index) => {
          const c = normalise(contact);
          const isEditing = editingIndex === index;
          return (
            <div key={index} className={`border rounded-xl p-4 transition-colors ${c.is_primary ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
              {isEditing && editContact ? (
                <ContactForm
                  contact={editContact}
                  onChange={updates => setEditContact(ec => ({ ...ec!, ...updates }))}
                  onSave={() => handleSaveEdit(index)}
                  onCancel={() => { setEditingIndex(null); setEditContact(null); }}
                  saveLabel="Save Changes"
                  isPrimary={c.is_primary}
                />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{c.name} {c.surname}</span>
                      {c.is_primary && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                          <Star className="w-3 h-3" />
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{c.email}</p>
                    <div className="flex flex-wrap gap-x-4 mt-0.5">
                      {c.mobile_phone && <p className="text-sm text-gray-500">Mobile: {c.mobile_phone}</p>}
                      {c.phone && <p className="text-sm text-gray-500">Office: {c.phone}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500">{permissionSummary(c)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!c.is_primary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(index)}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Set as primary"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(index)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      disabled={contacts.length === 1}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6 text-sm">
        <p className="font-semibold text-blue-900 mb-2">Permission Guidelines</p>
        <ul className="text-blue-800 space-y-1 list-disc list-inside">
          <li>The <strong>primary contact</strong> automatically receives all permissions.</li>
          <li>Restrict <strong>Change Account Numbers</strong> to trusted users only — an incorrect change can cause fuel charges to appear on the wrong client account.</li>
          <li>Vehicle registration numbers are validated against the client organisation — a driver cannot refuel under a different client's account number using their vehicle registration.</li>
          <li>Click <strong>Save Changes</strong> at the bottom of the page after any updates.</li>
        </ul>
      </div>
    </div>
  );
}
