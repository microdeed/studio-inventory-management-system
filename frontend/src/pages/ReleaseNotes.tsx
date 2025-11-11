import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

interface ReleaseNote {
  id: number;
  version: string;
  notes: string;
  release_date: string;
  created_at: string;
  created_by: number | null;
}

interface ReleaseNotesResponse {
  data: ReleaseNote[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const ReleaseNotes: React.FC = () => {
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set([0])); // First item expanded by default
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchReleaseNotes();
  }, [page]);

  const fetchReleaseNotes = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ReleaseNotesResponse>(`/api/version/release-notes?page=${page}&limit=20`);
      setReleaseNotes(response.data.data);
      setTotalPages(response.data.pagination.pages);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch release notes:', err);
      setError('Failed to load release notes. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedVersions(newExpanded);
  };

  const formatDate = (dateString: string) => {
    // Parse as local date to avoid timezone conversion issues
    // dateString format: "2025-01-05" (YYYY-MM-DD)
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatNotes = (notes: string) => {
    // Split by newlines and render as plain text with monospace font
    const lines = notes.split('\n').filter(line => line.trim());
    const elements: JSX.Element[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Check if it's a header (all caps or starts with ##)
      if (trimmed.match(/^#+\s/) || (trimmed === trimmed.toUpperCase() && trimmed.length < 50)) {
        elements.push(
          <h4 key={`header-${idx}`} className="font-mono text-sm font-semibold mt-8 mb-4 text-gray-900 first:mt-3">
            {trimmed.replace(/^#+\s/, '')}
          </h4>
        );
        return;
      }

      // Check if it's a list item (starts with -, *, or •)
      if (trimmed.match(/^[-*•]/)) {
        elements.push(
          <div key={`item-${idx}`} className="font-mono text-sm text-gray-700 ml-4 mb-2">
            {trimmed}
          </div>
        );
        return;
      }

      // Regular paragraph
      elements.push(
        <p key={`para-${idx}`} className="font-mono text-sm text-gray-700 mb-2">
          {trimmed}
        </p>
      );
    });

    return elements;
  };

  if (loading && releaseNotes.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading release notes...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText size={32} className="text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">Release Notes</h1>
        </div>
        <p className="text-gray-600">
          View the complete history of updates and improvements to Studio Inventory
        </p>
      </div>

      {/* Release Notes List */}
      <div className="space-y-4">
        {releaseNotes.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <FileText size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No release notes available yet.</p>
          </div>
        ) : (
          releaseNotes.map((note, index) => {
            const isExpanded = expandedVersions.has(index);

            return (
              <div
                key={note.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Version Header */}
                <button
                  onClick={() => toggleExpanded(index)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Tag size={20} className="text-blue-600" />
                      <span className="text-xl font-bold text-gray-800">
                        v{note.version}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={16} />
                      <span>{formatDate(note.release_date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                        Latest
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-gray-600" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-600" />
                    )}
                  </div>
                </button>

                {/* Release Notes Content */}
                {isExpanded && (
                  <div className="px-12 py-6 border-t border-gray-200 bg-gray-50">
                    <div className="max-w-none pl-8">
                      {formatNotes(note.notes)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>

          <span className="px-4 py-2 text-gray-700">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
