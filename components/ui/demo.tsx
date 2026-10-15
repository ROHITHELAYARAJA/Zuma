"use client";
import AIThinkingBlock from "@/components/ui/ai-thinking-block";
import { SiriWave } from "@/components/ui/siri-wave";
export default function DemoOne(){return <div className="bg-background p-6 text-foreground"><AIThinkingBlock/></div>;}
export function SiriWaveFluidDotsDemo(){return <div className="flex items-center justify-center bg-background p-8 text-foreground"><SiriWave variant="fluid-dots" size={240}/></div>;}
