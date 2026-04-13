/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Activity, Zap, Settings2, RotateCcw, Info, Lock } from 'lucide-react';
import { NeuronSim, SimulationParams, SimulationState, SynapseParams } from '@/src/lib/neuron-sim';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const MAX_DATA_POINTS = 10000; // 1.0s at 0.1ms resolution

function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

const INITIAL_PARAMS: SimulationParams = {
  excitatory: {
    numSynapses: 1,
    frequency: 3,
    weight: 0.5,
    tau: 2.5,
    distance: 50,
  },
  inhibitory: {
    numSynapses: 1,
    frequency: 3,
    weight: 0.5,
    tau: 2.5,
    distance: 50,
  },
  spikeThreshold: -55,
  inhReversalPotential: -90,
};

export default function App() {
  const [studentId, setStudentId] = useState('');
  const [confirmStudentId, setConfirmStudentId] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState('');

  const [params, setParams] = useState<SimulationParams>(INITIAL_PARAMS);
  const [currentVm, setCurrentVm] = useState(-70);

  const [data, setData] = useState<SimulationState[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [yMax, setYMax] = useState(0);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  
  const simRef = useRef<NeuronSim>(new NeuronSim());
  const requestRef = useRef<number>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Initialize simulation
  useEffect(() => {
    simRef.current.reset(params);
    
    const vmInterval = setInterval(() => {
      setCurrentVm(simRef.current.getVmSoma());
    }, 5);
    
    return () => clearInterval(vmInterval);
  }, []);

  // Simulation loop
  useEffect(() => {
    const animate = () => {
      if (!isPaused && isAuthorized) {
        let allNewStates: SimulationState[] = [];
        for (let i = 0; i < scrollSpeed; i++) {
          const newStates = simRef.current.step(params);
          allNewStates = [...allNewStates, ...newStates];
        }
        
        setData(prev => {
          const newData = [...prev, ...allNewStates];
          if (newData.length > MAX_DATA_POINTS) {
            return newData.slice(newData.length - MAX_DATA_POINTS);
          }
          return newData;
        });
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [params, isPaused, scrollSpeed, isAuthorized]);

  // D3 Chart Effect
  useEffect(() => {
    if (!svgRef.current || data.length === 0 || !isAuthorized) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = { top: 60, right: 30, bottom: 40, left: 50 }; // Larger top margin for raster

    svg.selectAll("*").remove();

    const x = d3.scaleLinear()
      .domain([0, MAX_DATA_POINTS])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([-95, yMax])
      .range([height - margin.bottom, margin.top]);

    // Grid lines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(10).tickSize(-height + margin.top + margin.bottom).tickFormat(() => ""))
      .attr("stroke", "#333")
      .attr("stroke-opacity", 0.2);

    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right).tickFormat(() => ""))
      .attr("stroke", "#333")
      .attr("stroke-opacity", 0.2);

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d => `${(Number(d) / 10000).toFixed(1)}s`))
      .attr("color", "#666");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y)
        .tickValues(d3.range(Math.floor(-95/5)*5, yMax + 5, 5))
        .tickFormat(d => (Number(d) % 10 === 0 ? `${d}mV` : ""))
      )
      .attr("color", "#666");

    // Raster Plot Area
    const rasterY = 25;
    svg.append("text")
      .attr("x", margin.left - 5)
      .attr("y", rasterY + 5)
      .attr("text-anchor", "end")
      .attr("font-family", "monospace")
      .attr("font-size", "10px")
      .attr("fill", "#666")
      .text("RASTER");

    // Render spikes
    data.forEach((d, i) => {
      const xPos = x(i + (MAX_DATA_POINTS - data.length));
      d.spikes.forEach(spike => {
        if (spike.type === 'post') return; // Skip postsynaptic spikes in raster

        let color = "#22c55e";
        let yOffset = 0;
        if (spike.type === 'inh') {
          color = "#ef4444";
          yOffset = 12;
        } else if (spike.type === 'post') {
          color = "#3b82f6";
          yOffset = 6;
        }

        svg.append("line")
          .attr("x1", xPos)
          .attr("x2", xPos)
          .attr("y1", rasterY - 10 + yOffset)
          .attr("y2", rasterY - 2 + yOffset)
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      });
    });

    // Vm Line
    const line = d3.line<SimulationState>()
      .x((_, i) => x(i + (MAX_DATA_POINTS - data.length)))
      .y(d => y(d.vmSoma))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("d", line);

    // Threshold line
    svg.append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(params.spikeThreshold))
      .attr("y2", y(params.spikeThreshold))
      .attr("stroke", "#f59e0b")
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", 0.8);

    // Resting potential line
    svg.append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(-70))
      .attr("y2", y(-70))
      .attr("stroke", "#ef4444")
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 0.5);

  }, [data, yMax, params.spikeThreshold, isAuthorized]);

  const handleRestart = () => {
    simRef.current.reset(params);
    setData([]);
    setIsPaused(false);
  };

  const handleRestoreDefaults = () => {
    setParams(INITIAL_PARAMS);
    setYMax(0);
    setScrollSpeed(3);
    simRef.current.reset(INITIAL_PARAMS);
    setData([]);
    setIsPaused(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (studentId !== confirmStudentId) {
      setError('IDs do not match');
      return;
    }
    
    if (studentId.length === 9 && /^\d+$/.test(studentId)) {
      // Seeded random for GABA reversal potential between -86 and -95
      const rand = seededRandom(studentId);
      const inhRev = -86 - Math.floor(rand * 10); // -86 to -95
      
      setParams(prev => ({
        ...prev,
        inhReversalPotential: inhRev
      }));
      
      setIsAuthorized(true);
    } else {
      setError('Student ID must be exactly 9 digits');
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Lock className="text-blue-500" size={24} />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-zinc-50">Student Gateway</CardTitle>
            <CardDescription className="text-zinc-400">
              Enter your 9-digit Student ID to access the simulator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studentId" className="text-zinc-400">Student ID</Label>
                <Input
                  id="studentId"
                  type="password"
                  placeholder="000000000"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmId" className="text-zinc-400">Confirm Student ID</Label>
                <Input
                  id="confirmId"
                  type="password"
                  placeholder="000000000"
                  value={confirmStudentId}
                  onChange={(e) => setConfirmStudentId(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6">
                Enter Simulator
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const updateParam = (type: 'excitatory' | 'inhibitory', key: keyof SynapseParams, value: number) => {
    setParams(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: value
      }
    }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-blue-500 mb-2">
              <Activity size={20} />
              <span className="text-xs font-mono uppercase tracking-widest text-blue-400">Neural Dynamics Lab</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-50">Synaptic Integration Simulator</h1>
            <p className="text-zinc-400 mt-2 max-w-2xl">
              Simulate postsynaptic membrane voltage dynamics in a compartmental neuron model with dual Poisson-distributed synaptic populations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              size="sm" 
              onClick={() => setIsPaused(!isPaused)}
              className="bg-zinc-100 text-black hover:bg-zinc-200 font-medium"
            >
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button 
              size="sm" 
              onClick={handleRestart}
              className="bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700 font-medium"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>
            <Button 
              size="sm" 
              onClick={handleRestoreDefaults}
              className="bg-zinc-100 text-black hover:bg-zinc-200 font-medium"
            >
              Restore Defaults
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Display */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden backdrop-blur-sm">
              <CardHeader className="border-b border-zinc-800/50 bg-zinc-900/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Zap size={18} className="text-yellow-500" />
                    Membrane Potential (Vm)
                  </CardTitle>
                  <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Exc Spikes
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      Inh Spikes
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Soma Vm
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[450px] w-full relative">
                  <svg ref={svgRef} className="w-full h-full" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">Real-time Membrane Potential</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-6xl font-bold font-mono tabular-nums tracking-tighter ${currentVm > params.spikeThreshold ? 'text-yellow-500' : 'text-blue-400'}`}>
                      {currentVm.toFixed(2)}
                    </span>
                    <span className="text-2xl font-light text-zinc-600 font-mono">mV</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-green-500">
                  <Zap size={20} />
                  Excitatory Population
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <SynapseControls 
                  params={params.excitatory} 
                  onChange={(key, val) => updateParam('excitatory', key, val)} 
                  color="green"
                />
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <Zap size={20} />
                  Inhibitory Population
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <SynapseControls 
                  params={params.inhibitory} 
                  onChange={(key, val) => updateParam('inhibitory', key, val)} 
                  color="red"
                />
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Settings2 size={20} className="text-zinc-400" />
                  Postsynaptic Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-zinc-300">Spike Threshold (mV)</Label>
                    <span className="text-yellow-500 font-mono text-sm">{params.spikeThreshold} mV</span>
                  </div>
                  <Slider
                    value={[params.spikeThreshold]}
                    min={-60}
                    max={0}
                    step={1}
                    onValueChange={(val) => setParams(p => ({ ...p, spikeThreshold: Array.isArray(val) ? val[0] : val }))}
                    className="py-2"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-zinc-300">Display Y-Max (mV)</Label>
                    <span className="text-blue-400 font-mono text-sm">{yMax} mV</span>
                  </div>
                  <Slider
                    value={[yMax]}
                    min={-60}
                    max={40}
                    step={5}
                    onValueChange={(val) => setYMax(Array.isArray(val) ? val[0] : val)}
                    className="py-2"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-zinc-300">Scrolling Speed</Label>
                    <span className="text-purple-400 font-mono text-sm">{scrollSpeed}x</span>
                  </div>
                  <Slider
                    value={[scrollSpeed]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(val) => setScrollSpeed(Array.isArray(val) ? val[0] : val)}
                    className="py-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SynapseControls({ params, onChange, color }: { 
  params: SynapseParams, 
  onChange: (key: keyof SynapseParams, val: number) => void,
  color: 'green' | 'red'
}) {
  const colorClass = color === 'green' ? 'text-green-400' : 'text-red-400';
  const receptorLabel = color === 'green' ? 'Number of AMPA receptors' : 'Number of GABA receptors';
  const cellLabel = color === 'green' ? 'NUMBER OF GLU INPUT CELLS' : 'NUMBER OF GABA INPUT CELLS';
  
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-zinc-400 text-xs uppercase tracking-wider">{cellLabel}</Label>
          <span className={`${colorClass} font-mono text-sm`}>{params.numSynapses}</span>
        </div>
        <Slider
          value={[params.numSynapses]}
          min={0}
          max={100}
          step={1}
          onValueChange={(val) => onChange('numSynapses', Array.isArray(val) ? val[0] : val)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-zinc-400 text-xs uppercase tracking-wider">Input Freq (Hz)</Label>
          <span className={`${colorClass} font-mono text-sm`}>{params.frequency.toFixed(1)}</span>
        </div>
        <Slider
          value={[params.frequency]}
          min={0.1}
          max={20}
          step={0.1}
          onValueChange={(val) => onChange('frequency', Array.isArray(val) ? val[0] : val)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-zinc-400 text-xs uppercase tracking-wider">{receptorLabel}</Label>
          <span className={`${colorClass} font-mono text-sm`}>{(params.weight * 10).toFixed(0)}</span>
        </div>
        <Slider
          value={[params.weight * 10]}
          min={0}
          max={10}
          step={1}
          onValueChange={(val) => {
            const n = Array.isArray(val) ? val[0] : val;
            onChange('weight', n / 10);
          }}
        />
        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
          <span>0 nS</span>
          <span className="text-zinc-400">{(params.weight).toFixed(2)} nS</span>
          <span>1.0 nS</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-zinc-400 text-xs uppercase tracking-wider">Channel Open Time (ms)</Label>
          <span className={`${colorClass} font-mono text-sm`}>{params.tau.toFixed(1)}</span>
        </div>
        <Slider
          value={[params.tau]}
          min={0.5}
          max={20}
          step={0.5}
          onValueChange={(val) => onChange('tau', Array.isArray(val) ? val[0] : val)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-zinc-400 text-xs uppercase tracking-wider">Distance from Soma (μm)</Label>
          <span className={`${colorClass} font-mono text-sm`}>{params.distance}</span>
        </div>
        <Slider
          value={[params.distance]}
          min={0}
          max={500}
          step={10}
          onValueChange={(val) => onChange('distance', Array.isArray(val) ? val[0] : val)}
        />
      </div>
    </div>
  );
}

