import React from 'react';
import { Play, Brain, ShieldAlert, Database, Activity, Sparkles } from 'lucide-react';

const NodeCard = ({ title, desc, icon: Icon, colorClass, gradientClass, tag }) => (
  <div className="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-gray-100/80 bg-white shadow-md w-48 sm:w-52 z-10 hover:scale-105 transition-all cursor-default shrink-0">
    <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-10 rounded-2xl`}></div>
    {tag && (
      <span className="absolute -top-2.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-white shadow-2xs border border-gray-100 text-gray-600">
        {tag}
      </span>
    )}
    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-2.5 shadow-sm ${colorClass}`}>
      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
    </div>
    <h4 className="font-bold text-gray-900 text-xs sm:text-sm text-center tracking-tight">{title}</h4>
    <p className="text-[10px] sm:text-[11px] text-gray-500 text-center mt-1 leading-tight font-medium">{desc}</p>
  </div>
);

const PipelineVisualizer = () => {
  return (
    <div className="w-full bg-gradient-to-br from-gray-50/90 to-blue-50/30 rounded-2xl p-4 sm:p-8 border border-gray-200/70 overflow-x-auto custom-scrollbar relative">
      
      {/* Scroll indicator hint for mobile */}
      <div className="sm:hidden flex items-center justify-end gap-1 text-[10px] font-semibold text-gray-400 mb-2">
        <span>Scroll horizontally to view pipeline</span> →
      </div>

      <div className="min-w-[820px] flex items-center justify-center gap-5 relative py-12">
        
        {/* Animated Flow Lines (Background) */}
        <div className="absolute top-1/2 left-12 right-12 h-1.5 bg-gray-200/80 -translate-y-1/2 z-0 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 w-1/3 animate-[flow_2s_linear_infinite]"></div>
        </div>

        {/* Branching Lines */}
        <div className="absolute top-1/2 left-[535px] w-[130px] h-[100px] border-t-2 border-r-2 border-dashed border-amber-300 rounded-tr-3xl -translate-y-full z-0 overflow-hidden">
          <div className="w-full h-full border-t-2 border-r-2 border-amber-400 opacity-60 rounded-tr-3xl animate-pulse"></div>
        </div>
        <div className="absolute top-1/2 left-[665px] w-[40px] h-[100px] border-b-2 border-l-2 border-dashed border-amber-300 rounded-bl-3xl -translate-y-0 z-0">
          <div className="w-full h-full border-b-2 border-l-2 border-amber-400 opacity-60 rounded-bl-3xl animate-pulse"></div>
        </div>

        {/* START Node */}
        <div className="flex flex-col items-center z-10 w-16 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center shadow-md animate-pulse">
            <Play className="w-4 h-4 text-white ml-0.5" />
          </div>
          <span className="text-[10px] font-extrabold text-gray-400 mt-2 tracking-wider">START</span>
        </div>

        {/* Node 1: Sentiment */}
        <NodeCard 
          title="1. Sentiment Analysis" 
          desc="Determines POSITIVE, NEUTRAL, or NEGATIVE tone." 
          icon={Activity} 
          colorClass="bg-blue-600"
          gradientClass="from-blue-400 to-cyan-300"
          tag="Pre-Node"
        />

        {/* Node 2: Evaluation */}
        <NodeCard 
          title="2. Lead Evaluation" 
          desc="Calculates QUALIFIED or NOT_INTERESTED + Confidence %." 
          icon={Brain} 
          colorClass="bg-purple-600"
          gradientClass="from-purple-400 to-pink-400"
          tag="LLM + Fallback"
        />

        {/* Branching Decision Nodes */}
        <div className="flex flex-col gap-12 relative z-10 shrink-0">
          
          {/* Node 3: Confidence Check (Top Branch) */}
          <div className="absolute -top-[125px] left-0">
            <div className="flex items-center gap-1.5 mb-2 ml-3">
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80 shadow-2xs">
                Score &lt; 0.60
              </span>
            </div>
            <NodeCard 
              title="3. Human Review" 
              desc="Routes uncertain calls to NEEDS_REVIEW queue." 
              icon={ShieldAlert} 
              colorClass="bg-amber-500"
              gradientClass="from-orange-400 to-amber-300"
              tag="Confidence Gate"
            />
          </div>

          {/* Node 4: State Update (Main Branch) */}
          <div className="mt-2">
            <div className="flex items-center gap-1.5 mb-2 ml-3">
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 shadow-2xs">
                Score &ge; 0.60
              </span>
            </div>
            <NodeCard 
              title="4. State Update" 
              desc="Persists status & broadcasts WebSocket update." 
              icon={Database} 
              colorClass="bg-emerald-600"
              gradientClass="from-green-400 to-emerald-300"
              tag="Auto-Approve"
            />
          </div>
        </div>

        {/* END Node */}
        <div className="flex flex-col items-center z-10 w-16 ml-8 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center shadow-md">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <span className="text-[10px] font-extrabold text-gray-400 mt-2 tracking-wider">END</span>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}} />
    </div>
  );
};

export default PipelineVisualizer;
