import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LiveMarketFeed({ currentPartId }) {
  const [listings, setListings] = useState([]);

  useEffect(() => {
    // 1. Pobierz obecne oferty z bazy
    const fetchInitialListings = async () => {
      const { data } = await supabase
        .from('market_listings')
        .select('*')
        .eq('part_id', currentPartId);
      if (data) setListings(data);
    };

    fetchInitialListings();

    // 2. Nasłuchuj nowych ofert z Allegro/OLX na żywo (Realtime)
    const subscription = supabase
      .channel('public:market_listings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_listings' }, payload => {
        // Dodaj nową ofertę do listy tylko jeśli pasuje do oglądanej części
        if (payload.new.part_id === currentPartId) {
          setListings(current => [...current, payload.new]);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [currentPartId]);

  return (
    <div className="bg-gray-900 p-5 rounded-xl border border-gray-700 shadow-2xl w-80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-red-500 font-bold tracking-widest text-sm">LIVE MARKET</h3>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      </div>
      
      <div className="space-y-3">
        {listings.length === 0 ? (
          <p className="text-gray-500 text-sm animate-pulse">AI przeszukuje rynek...</p>
        ) : (
          listings.map((item) => (
            <div key={item.id} className="bg-gray-800 p-3 rounded border border-gray-700 hover:border-red-500 transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase text-gray-400">{item.source}</span>
                <span className="text-green-400 font-mono font-bold">{item.price} PLN</span>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">{item.condition}</span>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                  Pokaż ofertę ↗
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}