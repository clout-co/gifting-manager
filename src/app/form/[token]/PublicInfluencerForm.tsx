'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import SearchableSelect, {
  type SearchableOption,
} from '@/components/ui/SearchableSelect';
import { useBankSearch, useBranchSearch } from '@/hooks/useBankSearch';

function toHalfWidth(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xff01 && code <= 0xff5e) {
      result += String.fromCharCode(code - 0xfee0);
    } else if (code === 0x3000) {
      result += ' ';
    } else {
      result += value[i];
    }
  }
  return result;
}

interface FormData {
  real_name: string;
  postal_code: string;
  address: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_branch: string;
  bank_code: string;
  branch_code: string;
  account_type: string;
  account_number: string;
  account_holder: string;
  invoice_registration_number: string;
  invoice_acknowledged: boolean;
}

interface PublicInfluencerFormProps {
  token: string;
  snsName: string;
  brandName: string;
  initialData: FormData;
}

export default function PublicInfluencerForm({
  token,
  snsName,
  brandName,
  initialData,
}: PublicInfluencerFormProps) {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [bankQuery, setBankQuery] = useState(initialData.bank_name || '');
  const [bankOpen, setBankOpen] = useState(false);
  const { banks, loading: banksLoading, error: banksError } = useBankSearch(bankQuery);

  const [branchQuery, setBranchQuery] = useState(initialData.bank_branch || '');
  const [branchOpen, setBranchOpen] = useState(false);
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
  } = useBranchSearch(formData.bank_code, branchQuery);

  const bankOptions: SearchableOption[] = useMemo(
    () =>
      banks.map((bank) => ({
        value: bank.code,
        label: bank.name,
        meta: bank.code,
        keywords: [bank.kana, toHalfWidth(bank.name)],
      })),
    [banks]
  );

  const branchOptions: SearchableOption[] = useMemo(
    () =>
      branches.map((branch) => ({
        value: branch.code,
        label: branch.name,
        meta: branch.code,
        keywords: [branch.kana, toHalfWidth(branch.name)],
      })),
    [branches]
  );

  const set =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFormData({ ...formData, [field]: e.target.value });

  const handleBankSelect = (value: string, option?: SearchableOption) => {
    if (!value) {
      setFormData({
        ...formData,
        bank_code: '',
        bank_name: '',
        branch_code: '',
        bank_branch: '',
      });
      setBranchQuery('');
      return;
    }
    setFormData({
      ...formData,
      bank_code: value,
      bank_name: option?.label || '',
      branch_code: '',
      bank_branch: '',
    });
    setBranchQuery('');
  };

  const handleBranchSelect = (value: string, option?: SearchableOption) => {
    if (!value) {
      setFormData({
        ...formData,
        branch_code: '',
        bank_branch: '',
      });
      return;
    }
    setFormData({
      ...formData,
      branch_code: value,
      bank_branch: option?.label || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.real_name.trim()) {
      setError('本名を入力してください');
      setLoading(false);
      return;
    }
    if (!formData.email.trim()) {
      setError('メールアドレスを入力してください');
      setLoading(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('正しいメールアドレスを入力してください');
      setLoading(false);
      return;
    }
    if (!formData.postal_code.trim()) {
      setError('郵便番号を入力してください');
      setLoading(false);
      return;
    }
    if (!/^\d{3}-?\d{4}$/.test(formData.postal_code.trim())) {
      setError('郵便番号はXXX-XXXXの形式で入力してください');
      setLoading(false);
      return;
    }
    if (!formData.phone.trim()) {
      setError('電話番号を入力してください');
      setLoading(false);
      return;
    }
    if (!formData.address.trim()) {
      setError('住所を入力してください');
      setLoading(false);
      return;
    }
    if (!formData.bank_name.trim() || !formData.bank_code.trim()) {
      setError('金融機関を選択してください');
      setLoading(false);
      return;
    }
    if (!formData.bank_branch.trim() || !formData.branch_code.trim()) {
      setError('支店を選択してください');
      setLoading(false);
      return;
    }
    if (!formData.account_number.trim() || !formData.account_holder.trim()) {
      setError('口座番号と口座名義を入力してください');
      setLoading(false);
      return;
    }
    if (formData.invoice_registration_number.trim()) {
      if (!/^T\d{13}$/.test(formData.invoice_registration_number.trim())) {
        setError('適格請求書発行事業者登録番号はT+13桁の数字で入力してください（例: T1234567890123）');
        setLoading(false);
        return;
      }
    }
    if (!formData.invoice_acknowledged) {
      setError('インボイス制度についての内容をご確認の上、承諾してください');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/form/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          data && typeof data.error === 'string'
            ? data.error
            : `送信に失敗しました (${res.status})`;
        throw new Error(message);
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
              <CheckCircle2 className="text-green-600 dark:text-green-400" size={48} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">送信完了</h1>
          <p className="text-muted-foreground text-sm">
            請求先情報の入力が完了しました。
            <br />
            ご協力ありがとうございます。
          </p>
          {brandName && (
            <p className="mt-4 text-xs text-muted-foreground">{brandName}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-8">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-2xl">
        <div className="p-6 border-b border-border">
          <div className="text-center">
            {brandName && (
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-1">
                {brandName}
              </p>
            )}
            <h1 className="text-xl font-bold text-foreground">
              請求先情報入力フォーム
            </h1>
            {snsName && (
              <p className="text-sm text-muted-foreground mt-1">
                @{snsName} 様
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            以下の情報を入力してください。<span className="text-red-500">*</span> は必須項目です。
          </p>

          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">本人情報</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  本名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.real_name}
                  onChange={set('real_name')}
                  className="input-field"
                  placeholder="山田 太郎"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={set('email')}
                  className="input-field"
                  placeholder="example@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  郵便番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={set('postal_code')}
                  className="input-field"
                  placeholder="123-4567"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  電話番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={set('phone')}
                  className="input-field"
                  placeholder="090-1234-5678"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                住所 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={set('address')}
                className="input-field"
                placeholder="東京都渋谷区..."
                required
              />
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">振込先情報</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  金融機関名 <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={formData.bank_code}
                  onChange={handleBankSelect}
                  options={bankOptions}
                  query={bankQuery}
                  onQueryChange={setBankQuery}
                  open={bankOpen}
                  onOpenChange={setBankOpen}
                  placeholder="金融機関を選択"
                  searchPlaceholder="金融機関名を入力して検索"
                  loading={banksLoading}
                  error={banksError || undefined}
                  emptyText="該当する金融機関がありません"
                  minQueryLength={1}
                  required
                  ariaLabel="金融機関名"
                  allowClear
                  syncQueryOnSelect
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  支店名 <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={formData.branch_code}
                  onChange={handleBranchSelect}
                  options={branchOptions}
                  query={branchQuery}
                  onQueryChange={setBranchQuery}
                  open={branchOpen}
                  onOpenChange={setBranchOpen}
                  placeholder={
                    formData.bank_code
                      ? '支店を選択'
                      : '先に金融機関を選択してください'
                  }
                  searchPlaceholder="支店名を入力して検索"
                  loading={branchesLoading}
                  error={branchesError || undefined}
                  emptyText="該当する支店がありません"
                  minQueryLength={0}
                  disabled={!formData.bank_code}
                  required
                  ariaLabel="支店名"
                  allowClear
                  syncQueryOnSelect
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  口座種類
                </label>
                <select
                  value={formData.account_type}
                  onChange={set('account_type')}
                  className="input-field"
                >
                  <option value="普通">普通</option>
                  <option value="当座">当座</option>
                  <option value="貯蓄">貯蓄</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  口座番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={set('account_number')}
                  className="input-field"
                  placeholder="1234567"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                口座名義（カタカナ） <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.account_holder}
                onChange={set('account_holder')}
                className="input-field"
                placeholder="ヤマダ タロウ"
                required
              />
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              適格請求書発行事業者登録番号
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              適格請求書発行事業者に登録されている場合は、Tから始まる登録番号を入力してください。
              登録されていない場合は空欄のまま進んでください。
            </p>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                登録番号
              </label>
              <input
                type="text"
                value={formData.invoice_registration_number}
                onChange={set('invoice_registration_number')}
                className="input-field"
                placeholder="T1234567890123"
              />
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              インボイス制度について（必ずお読みください） <span className="text-red-500">*</span>
            </h3>
            <div className="text-xs text-muted-foreground leading-relaxed bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-2">
              <p>
                インボイス制度の導入に伴い、インボイスに登録されていない個人事業主並びに事業者様に関しましては、
                税額としてご依頼額の2%（消費税額の20%）をご負担いただきます。（差し引いた金額をお振込させていただきます。）
              </p>
              <p>
                インボイス番号をご入力いただいている個人事業主並びに事業者様に関しましては差し引きはありません。
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.invoice_acknowledged}
                onChange={(e) =>
                  setFormData({ ...formData, invoice_acknowledged: e.target.checked })
                }
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-foreground">
                内容を読み、承諾しました。 <span className="text-red-500">*</span>
              </span>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Send size={18} />
            )}
            {loading ? '送信中...' : '送信する'}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            入力された情報は請求処理のためにのみ使用されます。
          </p>
        </form>
      </div>
    </div>
  );
}
