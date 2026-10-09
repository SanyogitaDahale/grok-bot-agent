import { createContext } from 'react';
import type { AgentConfigType } from '@/type/agent';


export const AgentConfigContext =
    createContext<any | null>(null);