import { useState, useRef, useEffect } from 'react';
import { Icons } from '../common/Icons';
import type { DetectedPort, ServiceType } from '@cc-orchestrator/shared';

interface PortSelectorProps {
  ports: DetectedPort[];
  selectedPort: number | null;
  onSelectPort: (port: number) => void;
  disabled?: boolean;
}

// Service type display labels
const SERVICE_LABELS: Partial<Record<ServiceType, string>> = {
  vite: 'Vite',
  nextjs: 'Next.js',
  cra: 'CRA',
  webpack: 'Webpack',
  flask: 'Flask',
  django: 'Django',
  rails: 'Rails',
  express: 'Express',
  node: 'Node',
};

export function PortSelector({ ports, selectedPort, onSelectPort, disabled }: PortSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedPortInfo = ports.find((p) => p.port === selectedPort);

  if (ports.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-700 rounded-lg text-theme-muted text-sm">
        <Icons.link />
        <span>No ports detected</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 bg-surface-700 rounded-lg text-sm transition-colors min-w-[120px] ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-600'
        }`}
      >
        <span className="font-mono text-theme-primary">
          :{selectedPort || ports[0]?.port}
        </span>
        {selectedPortInfo?.serviceType && selectedPortInfo.serviceType !== 'unknown' && (
          <span className="text-xs text-theme-muted">
            {SERVICE_LABELS[selectedPortInfo.serviceType] || selectedPortInfo.serviceType}
          </span>
        )}
        <Icons.chevronDown />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] bg-surface-700 rounded-lg border border-surface-600 shadow-lg z-50 overflow-hidden">
          {ports.map((port) => (
            <button
              key={port.port}
              onClick={() => {
                onSelectPort(port.port);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-600 transition-colors ${
                port.port === selectedPort ? 'bg-frost-4/20 text-frost-3' : 'text-theme-primary'
              }`}
            >
              <span className="font-mono">:{port.port}</span>
              <div className="flex items-center gap-2">
                {port.serviceType && port.serviceType !== 'unknown' && (
                  <span className="text-xs text-theme-muted">
                    {SERVICE_LABELS[port.serviceType] || port.serviceType}
                  </span>
                )}
                {!port.isAccessible && (
                  <span className="text-[10px] px-1 py-0.5 bg-aurora-4/20 text-aurora-3 rounded">
                    localhost
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
