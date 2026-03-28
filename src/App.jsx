import React from 'react';
import DamagePanel from './components/DamagePanel';
import LiveMarketFeed from './components/LiveMarketFeed';

function App() {
  // Symulacja tego, co zwróciłoby AI (Kolega B) na wejściu auta do warsztatu
  const mockDetectedDamages = ['zderzak_przod', 'lampa_przod_lewa'];

  return (
    <div className="min-h-screen bg-black p-8 flex gap-8 justify-center items-start font-sans">
      {/* Panel główny wyceny (JSON) */}
      <DamagePanel detectedDamages={mockDetectedDamages} />
      
      {/* Panel boczny z ofertami na żywo (Supabase) - np. dla zderzaka */}
      <LiveMarketFeed currentPartId="zderzak_przod" />
    </div>
  );
}

export default App;