import React from 'react';
import { Play, Brain, ShieldAlert, Database, CheckCircle, Activity, ArrowRight, CornerDownRight, CornerRightUp } from 'lucide-react';

const NodeCard = ({ title, desc, icon: Icon, colorClass, gradientClass, delay }) => (
  <div className={`relative flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 bg-white shadow-lg w-48 z-10 hover:scale-105 transition-transform cursor-default ${delay}`}>
    <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-10 rounded-xl`}></div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm ${colorClass}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <h4 className="font-bold text-gray-900 text-sm text-center">{title}</h4>
    <p className="text-[10px] text-gray-500 text-center mt-1 leading-tight">{desc}</p>
  </div>
);

const PipelineVisualizer = () => {
  return (
    <div className="w-full bg-gray-50/50 rounded-2xl p-8 border border-gray-100 mt-6 overflow-x-auto">
      <div className="min-w-[800px] flex items-center justify-center gap-4 relative py-12">
        
        {/* Animated Flow Lines (Background) */}
        <div className="absolute top-1/2 left-10 right-10 h-1 bg-gray-200 -translate-y-1/2 z-0 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-400 via-purple-500 to-green-400 w-1/3 animate-[flow_2s_linear_infinite]"></div>
        </div>

        {/* Branching Lines */}
        <div className="absolute top-1/2 left-[520px] w-[140px] h-[100px] border-t-2 border-r-2 border-dashed border-gray-300 rounded-tr-3xl -translate-y-full z-0 overflow-hidden">
             <div className="w-full h-full border-t-2 border-r-2 border-orange-400 opacity-50 rounded-tr-3xl animate-pulse"></div>
        </div>
        <div className="absolute top-1/2 left-[660px] w-[40px] h-[100px] border-b-2 border-l-2 border-dashed border-gray-300 rounded-bl-3xl -translate-y-0 z-0">
             <div className="w-full h-full border-b-2 border-l-2 border-orange-400 opacity-50 rounded-bl-3xl animate-pulse"></div>
        </div>

        {/* START Node */}
        <div className="flex flex-col items-center z-10 w-16">
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shadow-lg animate-pulse">
            <Play className="w-4 h-4 text-white ml-0.5" />
          </div>
          <span className="text-[10px] font-bold text-gray-500 mt-2">START</span>
        </div>

        {/* Node 1: Sentiment */}
        <NodeCard 
          title="1. Sentiment Analysis" 
          desc="Detects POSITIVE, NEUTRAL, or NEGATIVE tone." 
          icon={Activity} 
          colorClass="bg-blue-500"
          gradientClass="from-blue-400 to-cyan-300"
          delay=""
        />

        {/* Node 2: Evaluation */}
        <NodeCard 
          title="2. Lead Evaluation" 
          desc="Determines QUALIFIED or NOT_INTERESTED with Confidence Score." 
          icon={Brain} 
          colorClass="bg-purple-500"
          gradientClass="from-purple-400 to-pink-400"
          delay=""
        />

        {/* Branching logic */}
        <div className="flex flex-col gap-12 relative z-10">
          
          {/* Node 3: Confidence Check (Top Branch) */}
          <div className="absolute -top-[120px] left-0">
            <div className="flex items-center gap-2 mb-2 ml-4">
              <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">Score &lt; 0.6</span>
            </div>
            <NodeCard 
              title="3. Confidence Check" 
              desc="Flags low confidence calls for NEEDS_REVIEW." 
              icon={ShieldAlert} 
              colorClass="bg-orange-500"
              gradientClass="from-orange-400 to-amber-300"
              delay=""
            />
          </div>

          {/* Node 4: State Update (Bottom/Main Branch) */}
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2 ml-4">
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Score &ge; 0.6</span>
            </div>
            <NodeCard 
              title="4. State Update" 
              desc="Saves final evaluation & triggers dashboard UI update." 
              icon={Database} 
              colorClass="bg-green-500"
              gradientClass="from-green-400 to-emerald-300"
              delay=""
            />
          </div>
        </div>

        {/* END Node */}
        <div className="flex flex-col items-center z-10 w-16 ml-8">
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shadow-lg">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <span className="text-[10px] font-bold text-gray-500 mt-2">END</span>
        </div>

      </div>

      {/* Tailwind Custom Animations */}
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
