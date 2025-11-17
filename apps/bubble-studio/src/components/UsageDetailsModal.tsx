import React, { useState, useMemo } from 'react';
import { X, Search, ChevronUp, ChevronDown } from 'lucide-react';
import type { SubscriptionStatusResponse } from '@bubblelab/shared-schemas';
import { SERVICE_LOGOS } from '../lib/integrations';

interface UsageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resetDate: string;
  serviceUsage: SubscriptionStatusResponse['usage']['serviceUsage'];
  limit: number;
}

type SortField = 'service' | 'subService' | 'usage' | 'unitCost' | 'totalCost';
type SortDirection = 'asc' | 'desc';

// Map credential service names to logo keys
const getServiceLogo = (service: string): string | null => {
  const serviceMap: Record<string, string> = {
    FIRECRAWL_API_KEY: 'Firecrawl',
    RESEND_CRED: 'Resend',
    APIFY_CRED: 'Apify',
    GOOGLE_GEMINI_CRED: 'Gemini',
    OPENAI_CRED: 'OpenAI',
    ANTHROPIC_CRED: 'Claude',
    SLACK_CRED: 'Slack',
    GMAIL_CRED: 'Gmail',
    GOOGLE_CALENDAR_CRED: 'Google Calendar',
    GOOGLE_DRIVE_CRED: 'Google Drive',
    GOOGLE_SHEETS_CRED: 'Google Sheets',
    POSTGRES_CRED: 'Postgres',
    CLOUDFLARE_CRED: 'Cloudflare',
    GITHUB_CRED: 'GitHub',
    REDDIT_CRED: 'Reddit',
    LINKEDIN_CRED: 'LinkedIn',
    YOUTUBE_CRED: 'YouTube',
    INSTAGRAM_CRED: 'Instagram',
  };

  const logoKey = serviceMap[service];
  return logoKey ? SERVICE_LOGOS[logoKey] : null;
};

export const UsageDetailsModal: React.FC<UsageDetailsModalProps> = ({
  isOpen,
  resetDate,
  onClose,
  serviceUsage,
  limit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalCost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let data = [...serviceUsage];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      data = data.filter(
        (item) =>
          item.service.toLowerCase().includes(query) ||
          item.subService?.toLowerCase().includes(query) ||
          item.unit.toLowerCase().includes(query)
      );
    }

    // Sort data
    data.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'service':
          aVal = a.service;
          bVal = b.service;
          break;
        case 'subService':
          aVal = a.subService || '';
          bVal = b.subService || '';
          break;
        case 'usage':
          aVal = a.usage;
          bVal = b.usage;
          break;
        case 'unitCost':
          aVal = a.unitCost;
          bVal = b.unitCost;
          break;
        case 'totalCost':
          aVal = a.totalCost;
          bVal = b.totalCost;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return data;
  }, [serviceUsage, searchQuery, sortField, sortDirection]);

  // Calculate totals
  const totalCost = useMemo(() => {
    return filteredAndSortedData.reduce((sum, item) => sum + item.totalCost, 0);
  }, [filteredAndSortedData]);

  const formatCost = (cost: number): string => {
    // If cost is less than 0.0001, show 8 decimal places for precision
    // Otherwise, show 4 decimal places
    const decimals = cost > 0 && cost < 0.0001 ? 8 : 4;
    return `$${cost.toFixed(decimals)}`;
  };

  const formatUnitCost = (
    unitCost: number
  ): { cost: string; shouldAppendMillion: boolean } => {
    // If unit cost is 0, show "free"
    if (unitCost === 0) {
      return {
        cost: 'FREE',
        shouldAppendMillion: false,
      };
    }
    // If unit cost is less than 0.0001, multiply by 1 million and append /million
    if (unitCost > 0 && unitCost < 0.0001) {
      const costPerMillion = unitCost * 1000000;
      return {
        cost: `$${costPerMillion.toFixed(4)}`,
        shouldAppendMillion: true,
      };
    }
    return {
      cost: formatCost(unitCost),
      shouldAppendMillion: false,
    };
  };

  const formatUnit = (unit: string, shouldAppendMillion: boolean): string => {
    return shouldAppendMillion ? `${unit}/million` : unit;
  };

  const formatLimit = (limit: number): string => {
    return `$${limit.toFixed(0)}`;
  };

  const formatUsage = (usage: number, unit: string): string => {
    if (unit.includes('per_1m')) {
      return `${usage.toFixed(2)}M`;
    }
    return usage.toLocaleString();
  };

  // Calculate billing period from resetDate
  // If resetDate is 2025-12-03T08:00:00.000Z, billing period is 2025-11-03 to 2025-12-03 (resets exactly at that time)
  const billingPeriod = useMemo(() => {
    if (!resetDate) return null;

    const reset = new Date(resetDate);

    // Start date: one month before reset date, same day and time
    const start = new Date(reset);
    start.setUTCMonth(start.getUTCMonth() - 1);

    // End date: reset date itself (billing resets exactly at this time)
    const end = new Date(reset);

    // Format dates preserving UTC timezone (as indicated by the Z in ISO string)
    const formatDate = (date: Date): string => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
    };

    return {
      start: formatDate(start),
      end: formatDate(end),
    };
  }, [resetDate]);

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) {
      return <div className="w-4 h-4" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#2a2826] border border-[#3d3935] rounded-lg shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#3d3935]">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">
              Managed Credentials Usage Details
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Usage of BubbleLab's managed API credentials. You're encouraged to
              bring your own API keys — when you do, you'll pay your provider
              directly and this usage won't apply.
            </p>
            {billingPeriod && (
              <p className="text-xs text-gray-500 mt-2 font-mono">
                Billing Period: {billingPeriod.start} to {billingPeriod.end}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-[#3d3935]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by service, sub-service, or unit..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#1a1816] border border-[#3d3935] text-gray-100 text-sm rounded-lg focus:outline-none focus:border-blue-500 placeholder-gray-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-[#1a1816]">
          <table className="w-full">
            <thead className="bg-[#2a2826] sticky top-0 z-10">
              <tr>
                <th
                  className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-[#1a1816]/50 transition-colors"
                  onClick={() => handleSort('service')}
                >
                  <div className="flex items-center gap-2">
                    Service
                    <SortIcon field="service" />
                  </div>
                </th>
                <th
                  className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-[#1a1816]/50 transition-colors"
                  onClick={() => handleSort('subService')}
                >
                  <div className="flex items-center gap-2">
                    Sub Service
                    <SortIcon field="subService" />
                  </div>
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Unit
                </th>
                <th
                  className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-[#1a1816]/50 transition-colors"
                  onClick={() => handleSort('usage')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Usage
                    <SortIcon field="usage" />
                  </div>
                </th>
                <th
                  className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-[#1a1816]/50 transition-colors"
                  onClick={() => handleSort('unitCost')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Unit Cost
                    <SortIcon field="unitCost" />
                  </div>
                </th>
                <th
                  className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-[#1a1816]/50 transition-colors"
                  onClick={() => handleSort('totalCost')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Total Cost
                    <SortIcon field="totalCost" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3935]">
              {filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="text-gray-400">
                      {searchQuery.trim()
                        ? 'No results found'
                        : 'No usage data available'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedData.map((item, index) => {
                  const logoPath = getServiceLogo(item.service);
                  const unitCostFormatted = formatUnitCost(item.unitCost);
                  return (
                    <tr
                      key={index}
                      className="hover:bg-[#2a2826]/40 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {logoPath && (
                            <img
                              src={logoPath}
                              alt={item.service}
                              className="w-5 h-5 flex-shrink-0"
                            />
                          )}
                          <span className="text-sm font-medium text-blue-400">
                            {item.service}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-300">
                          {item.subService || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-400 bg-[#2a2826]/60 px-2 py-1 rounded">
                          {formatUnit(
                            item.unit,
                            unitCostFormatted.shouldAppendMillion
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-sm text-gray-200 font-mono">
                          {formatUsage(item.usage, item.unit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-sm text-gray-300 font-mono">
                          {unitCostFormatted.cost}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span
                          className={`text-sm font-semibold font-mono ${
                            item.totalCost > 0
                              ? 'text-purple-400'
                              : 'text-gray-500'
                          }`}
                        >
                          {formatCost(item.totalCost)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with totals */}
        <div className="border-t border-[#3d3935] bg-[#1a1816] p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {filteredAndSortedData.length} of {serviceUsage.length}{' '}
              services
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-300">
                Total Cost:
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-purple-400 font-mono">
                  {formatCost(totalCost)}
                </span>
                <span className="text-sm text-gray-500 font-mono">
                  / {formatLimit(limit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageDetailsModal;
