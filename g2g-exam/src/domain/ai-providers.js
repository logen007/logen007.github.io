// Shared provider identity for settings, grading and reporting. No credentials.
export const AI_PROVIDERS=[
  {id:'groq',label:'Groq',settingsLabel:'Groq'},
  {id:'gemini',label:'Gemini',settingsLabel:'Google AI Studio (Gemini)'},
  {id:'grok',label:'Grok',settingsLabel:'Grok (xAI)'},
  {id:'mistral',label:'Mistral',settingsLabel:'Mistral'},
  {id:'cerebras',label:'Cerebras',settingsLabel:'Cerebras'},
];
export const AI_PROVIDER_IDS=AI_PROVIDERS.map(provider=>provider.id);
export const aiProviderLabel=id=>AI_PROVIDERS.find(provider=>provider.id===id)?.label||'AI';
export const normalizeAiProvider=id=>AI_PROVIDER_IDS.includes(id)?id:'groq';
