"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function SmsDashboard({ context }: { context?: any }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (context) {
          if (context.phone_number) setPhoneNumber(context.phone_number);
          if (context.message) setMessage(context.message);
      }
  }, [context]);

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAiTyping]);

  useEffect(() => {
      if (context && chatHistory.length === 0 && !isAiTyping) {
          triggerAutoDraft();
      }
  }, [context]);

  const triggerAutoDraft = async () => {
      setIsAiTyping(true);
      try {
          const response = await fetch('/api/llm/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  prompt: "", 
                  history: [], 
                  context: context, 
                  is_initial: true 
              })
          });
          const data = await response.json();
          setIsAiTyping(false);
          if (data.status === 'success') {
              setChatHistory([{ role: 'assistant', content: data.message }]);
              setMessage(data.message); // Auto-fill the message box
          } else {
              setChatHistory([{ role: 'assistant', content: "Error: " + data.message, isError: true }]);
          }
      } catch (error) {
          setIsAiTyping(false);
          setChatHistory([{ role: 'assistant', content: "Failed to reach AI Engine.", isError: true }]);
      }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMsg = message;
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setMessage('');
    setIsAiTyping(true);

    try {
        const response = await fetch('/api/llm/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: userMsg,
                history: chatHistory,
                context: context,
                is_initial: false
            })
        });
        
        const data = await response.json();
        setIsAiTyping(false);

        if (data.status === 'success') {
            setChatHistory(prev => [...prev, { role: 'assistant', content: data.message }]);
            setMessage(data.message); // Auto-fill the message box
        } else {
            setChatHistory(prev => [...prev, { role: 'assistant', content: "Error: " + data.message, isError: true }]);
        }
    } catch (error) {
        setIsAiTyping(false);
        setChatHistory(prev => [...prev, { role: 'assistant', content: "Failed to reach AI Engine.", isError: true }]);
    }
  };

  const handleDirectSms = async () => {
    if (!phoneNumber.trim() || !message.trim()) return;
    setIsSending(true);
    try {
        const destName = context?.destinationName || "Unknown Safe Area";
        const destCoords = context?.destinationCoords ? `${context.destinationCoords[0].toFixed(4)}, ${context.destinationCoords[1].toFixed(4)}` : "";
        const res = await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phone_number: phoneNumber, 
                message: message, 
                destination_name: destName, 
                destination_coords: destCoords,
                route_geojson: context?.routeGeoJSON || null
            })
        });
        const data = await res.json();
        
        if(res.ok) {
            setChatHistory(prev => [...prev, { role: 'system', content: `SMS Dispatched to ${phoneNumber}` }]);
            setMessage('');
        } else {
            setChatHistory(prev => [...prev, { role: 'system', content: `SMS Failed: ${data.detail}`, isError: true }]);
        }
    } catch (e) {
        setChatHistory(prev => [...prev, { role: 'system', content: `Network Error while sending SMS.`, isError: true }]);
    } finally {
        setIsSending(false);
    }
  };

  return (
    <section className="bg-surface-glass backdrop-blur-24 rounded-xl flex flex-col shadow-xl border border-white/10 w-[450px] h-[600px] pointer-events-auto">
        <header className="p-4 border-b border-white/10 flex items-center gap-2 bg-white/5 rounded-t-xl">
            <span className="material-symbols-outlined text-tertiary">chat</span>
            <h2 className="font-title-lg text-title-lg text-tertiary">Comms Console</h2>
        </header>

        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
            {/* Target Info */}
            <div className="flex justify-between items-center p-3 bg-surface-container border border-white/10 rounded">
                <div>
                    <span className="font-label-caps text-label-caps text-on-surface-variant block">Target Device</span>
                    <input 
                        type="text" 
                        placeholder="Recipient Number" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="bg-transparent border-none p-0 focus:ring-0 text-on-surface font-data-mono text-data-mono mt-1 placeholder:text-on-surface-variant/50"
                    />
                </div>
                <button onClick={handleDirectSms} disabled={isSending || !phoneNumber || !message} className={`flex items-center justify-center p-2 rounded ${isSending || !phoneNumber || !message ? 'text-on-surface-variant cursor-not-allowed' : 'text-status-success hover:bg-white/5'}`} title="Dispatch SMS">
                   <span className="material-symbols-outlined">{isSending ? 'hourglass_empty' : 'send_to_mobile'}</span>
                </button>
            </div>

            {/* Message History */}
            <div className="flex-1 flex flex-col gap-3 min-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                {chatHistory.length === 0 && !isAiTyping && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/50 mb-3">forum</span>
                        <p className="font-label-caps text-on-surface-variant">
                            Awaiting interaction. Chat with AI to draft messages.
                        </p>
                    </div>
                )}
                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'self-end max-w-[85%] text-right' : 'self-start max-w-[85%]'}`}>
                        <span className="font-label-caps text-[10px] text-on-surface-variant mb-1 block">
                            {msg.role === 'user' ? 'Operator' : msg.role === 'system' ? 'System Auto' : 'AI Engine'}
                        </span>
                        {msg.role === 'system' ? (
                            <div className={`p-3 rounded-lg text-sm ${msg.isError ? 'bg-error-container text-on-error-container' : 'bg-surface-container-highest text-status-success'}`}>
                                {msg.content}
                            </div>
                        ) : msg.role === 'user' ? (
                            <div className="bg-tertiary-container text-on-tertiary-container p-3 rounded-l-lg rounded-br-lg text-sm inline-block text-left whitespace-pre-wrap">
                                {msg.content}
                            </div>
                        ) : (
                            <div className={`p-3 rounded-r-lg rounded-bl-lg text-sm whitespace-pre-wrap ${msg.isError ? 'bg-error-container text-on-error-container' : 'bg-surface-container-highest text-on-surface'}`}>
                                {msg.content}
                            </div>
                        )}
                    </div>
                ))}
                
                {isAiTyping && (
                    <div className="self-start max-w-[85%]">
                        <span className="font-label-caps text-[10px] text-on-surface-variant mb-1 block">AI Engine</span>
                        <div className="bg-surface-container-highest p-3 rounded-r-lg rounded-bl-lg flex items-center gap-1.5 h-[44px]">
                            <div className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* AI Compose Area */}
            <form onSubmit={handleSend} className="mt-auto border-t border-white/10 pt-4">
                <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-secondary text-sm">auto_awesome</span>
                    <span className="font-label-caps text-label-caps text-secondary">Local AI Engine</span>
                </div>
                
                <div className="relative rounded-lg bg-surface-container border border-white/10 focus-within:border-tertiary focus-within:shadow-[0_0_0_1px_#adc6ff] transition-all overflow-hidden">
                    <textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full bg-transparent border-none text-on-surface font-body-md text-sm p-3 pr-10 focus:ring-0 resize-none h-[80px]" 
                        placeholder="Draft response or prompt AI..."
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                    ></textarea>
                    <div className="absolute bottom-2 right-2">
                        <button type="submit" disabled={!message.trim() || isAiTyping} className={`p-1.5 rounded flex items-center justify-center transition-colors ${!message.trim() || isAiTyping ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed' : 'bg-tertiary text-on-tertiary hover:bg-tertiary/90 cursor-pointer active:scale-95'}`}>
                            <span className="material-symbols-outlined text-sm">send</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </section>
  );
}
