import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Company } from '@/types';

const defaultCompany: Company = {
  id: '1',
  name: 'Vidraçaria Central',
  cnpj: '12.345.678/0001-90',
};

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [currentCompany, setCurrentCompany] = useState<Company>(defaultCompany);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        currentCompany={currentCompany} 
        onCompanyChange={setCurrentCompany} 
      />
      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
