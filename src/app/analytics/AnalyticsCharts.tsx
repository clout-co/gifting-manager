'use client';

import {
  Award,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ROIData } from './types';
import { formatCurrency, formatNumber, formatTooltipValue } from './utils';

const COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
];

export default function AnalyticsCharts({ roiData }: { roiData: ROIData }) {
  return (
    <>
      {/* グラフエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 月別ROI推移 */}
        <div className="card lg:col-span-2">
          <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
            <TrendingUp className="text-green-500" size={20} />
            月別ROI推移
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={roiData.monthly}>
                <defs>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value, name) => {
                    if (name === 'コスト' || name === 'いいね単価') return formatTooltipValue(value, 'currency');
                    return formatTooltipValue(value, 'number');
                  }}
                />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="spent"
                  fill="url(#colorSpent)"
                  stroke="#8b5cf6"
                  name="コスト"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="costPerLike"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2 }}
                  name="いいね単価"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ブランド別ROI */}
        <div className="card">
          <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
            <PieChartIcon className="text-purple-500" size={20} />
            ブランド別コスト構成
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roiData.byBrand}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="spent"
                  nameKey="brand"
                >
                  {roiData.byBrand.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatTooltipValue(value, 'currency')}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {roiData.byBrand.slice(0, 6).map((item, index) => (
              <div key={item.brand} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-muted-foreground">{item.brand}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ブランド別効率 */}
        <div className="card">
          <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
            <Zap className="text-amber-500" size={20} />
            ブランド別効率（いいね単価）
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roiData.byBrand.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="brand" width={60} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => formatTooltipValue(value, 'currency')}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="costPerLike" fill="#10b981" radius={[0, 4, 4, 0]} name="いいね単価" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* インフルエンサー効率ランキング */}
      <div className="card">
        <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
          <Award className="text-yellow-500" size={20} />
          コスパ優秀インフルエンサー TOP10
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header px-4 py-3">順位</th>
                <th className="table-header px-4 py-3">インフルエンサー</th>
                <th className="table-header px-4 py-3">案件数</th>
                <th className="table-header px-4 py-3">総コスト</th>
                <th className="table-header px-4 py-3">総いいね</th>
                <th className="table-header px-4 py-3">いいね単価</th>
                <th className="table-header px-4 py-3">効率スコア</th>
              </tr>
            </thead>
            <tbody>
              {roiData.byInfluencer.map((inf, index) => (
                <tr key={inf.insta_name || index} className="table-row">
                  <td className="table-cell">
                    <span
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                        index === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : index === 1
                            ? 'bg-muted text-foreground'
                            : index === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="table-cell font-medium">@{inf.insta_name || '不明'}</td>
                  <td className="table-cell">{inf.campaigns}件</td>
                  <td className="table-cell">{formatCurrency(inf.spent)}</td>
                  <td className="table-cell text-pink-600 font-medium">{formatNumber(inf.likes)}</td>
                  <td className="table-cell">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      {formatCurrency(inf.costPerLike)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                          style={{ width: `${Math.min(inf.efficiency, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12">{inf.efficiency.toFixed(1)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 商品別分析 */}
      <div className="card">
        <h3 className="font-bold text-foreground mb-6 flex items-center gap-2">
          <BarChart3 className="text-indigo-500" size={20} />
          商品別ROI分析
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roiData.byItem}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="item_code" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                }}
                formatter={(value, name) => {
                  if (name === 'コスト' || name === 'いいね単価') return formatTooltipValue(value, 'currency');
                  return formatTooltipValue(value, 'number');
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="likes" fill="#ec4899" name="いいね" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="spent" fill="#8b5cf6" name="コスト" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="costPerLike" stroke="#10b981" strokeWidth={2} name="いいね単価" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

