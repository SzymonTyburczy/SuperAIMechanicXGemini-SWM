import React from 'react';
import partsData from '../data/parts_db.json';

export default function DamagePanel({ detectedDamages }) {
  // Wyciągamy bazę części z JSONa (na sztywno dla Audi na potrzeby dema)
  const dbParts = partsData.models.audi_a5_2022.parts;

  // Łączymy to co wykryło AI z cenami z naszej bazy
  const damageDetails = detectedDamages.map(damageId => {
    return dbParts.find(p => p.id === damageId);
  }).filter(Boolean);

  const totalCost = damageDetails.reduce((sum, part) => sum + part.price_market, 0);

  return (
    <div className="bg-gray-900 text-white p-6 rounded-xl border border-gray-800 shadow-2xl w-[400px]">
      <h2 className="text-xl font-bold tracking-tight text-red-500 mb-4">WYCENA SZKÓD</h2>
      
      <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
        {damageDetails.map((part) => (
          <div key={part.id} className="bg-gray-800/80 p-4 rounded-lg border-l-4 border-red-600">
            <h3 className="font-semibold text-sm uppercase">{part.name}</h3>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">Średnia giełdowa:</span>
              <span className="text-lg font-mono font-bold text-green-400">{part.price_market} PLN</span>
            </div>
            {part.predicted_hidden_damages.length > 0 && (
              <div className="mt-3 bg-red-950/30 p-2 rounded text-xs border border-red-900/50">
                <span className="text-red-400 font-bold block mb-1">Ryzyko ukryte:</span>
                <span className="text-gray-400">{part.predicted_hidden_damages.join(', ')}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
        <span className="text-gray-400 font-medium text-sm uppercase">Suma części</span>
        <span className="text-2xl font-mono font-black text-white">{totalCost} PLN</span>
      </div>
    </div>
  );
}