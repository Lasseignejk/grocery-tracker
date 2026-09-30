'use client';

import { useState, useRef, useEffect } from 'react';

interface AutocompleteInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  helpText?: string;
}

// Helper function to capitalize first letter of each word
function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function AutocompleteInput({
  id,
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  helpText,
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasInteracted, setHasInteracted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (value.trim() && hasInteracted) {
      const filtered = suggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setIsOpen(false);
    }
    setHighlightedIndex(-1);
  }, [value, suggestions, hasInteracted]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHasInteracted(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onChange(filteredSuggestions[highlightedIndex]);
          setIsOpen(false);
          setHasInteracted(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHasInteracted(false);
        break;
    }
  };

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    setHasInteracted(false);
  };

  const handleFocus = () => {
    setHasInteracted(true);
    // Only show dropdown if user has typed something
    if (value.trim()) {
      const filtered = suggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      if (filtered.length > 0) {
        setFilteredSuggestions(filtered);
        setIsOpen(true);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasInteracted(true);
    onChange(e.target.value.toLowerCase());
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={capitalizeWords(value)}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        autoComplete="off"
      />
      {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}

      {/* Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${
                index === highlightedIndex ? 'bg-blue-100' : ''
              }`}
            >
              {capitalizeWords(suggestion)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
