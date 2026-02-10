import React, { useState, useEffect, useRef} from 'react'
import { io, Socket } from 'socket.io-client'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL

function App() {
  const [join, setJoin] = useState(true);
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState([""]);
  const [sessionId, setSessionId] = useState("");
  const [session, setSession] = useState<null | {title: string; votes: Record<string, number>}>(null);
  const [joinSessionId, setJoinSessionId] = useState("");

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if(!socketRef.current){
      const socket = io(API_URL);
      socketRef.current = socket;
    }
    const socket = socketRef.current;
    socketRef.current?.on("session-updated", (votes) => {
      setSession(prev => prev ? {...prev, votes: votes} : prev);
    });
    socket.on("connect", async() => {
      const currentId = localStorage.getItem("currentSession");
      if(currentId){
        await joinSessionWithId(currentId);
      }
    });

    return () => {
      socket.off("session-updated");
      socket.off("connect");
      socketRef.current = null;
    }
  }, [])

  function handleInputChange(index: number, value: string){
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  }

  function handleOnKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>){
    if(event.key === "Enter"){
      event.preventDefault();
      if(index == options.length-1){
        setOptions([...options, ""]);
      }
    }
  }
  function validateForm(){

    if(title.trim() === "") return false;
    const filteredOptions = options.filter((option) => option.trim() !== "");
    if(filteredOptions.length < 2) return false;
    return true;
  }
  async function createSession(){
    if(!validateForm()){
      alert("Please enter a title and at least 2 options");
      return;
    }
    const response = await fetch(`${API_URL}/create-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: title,
        options: options.filter((option) => option.trim() !== "")
      })
    });

    if(!response.ok){
      alert("Failed to create session");
      return;
    }

    const id = (await response.json()).sessionId;
    localStorage.setItem('currentSession', id);
    setSessionId(id);
    socketRef.current?.emit("join-session", id)

    setTitle("");
    setOptions([""]);

    //load next session
    await joinSessionWithId(id);
  }

  async function joinSessionWithId(id: string){
    const res = await fetch(`${API_URL}/session/${id}`);
    if(!res.ok){
      alert("Failed to join session");
      return;
    }
    localStorage.setItem('currentSession', id);
    let voterToken = localStorage.getItem(`voterToken:${id}`)

    if(!voterToken){
      const tokenReq = await fetch(`${API_URL}/join-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await tokenReq.json();
      voterToken = data.voterToken;
      localStorage.setItem(`voterToken:${id}`, voterToken||"");
    }
    socketRef.current?.emit("join-session", id);
    setSessionId(id);
    setSession(await res.json());

  }
  
  function handleSubmit(e: React.SubmitEvent){
    e.preventDefault();
    createSession();
  }

  async function handleVote(option: string){
    let voterToken = localStorage.getItem(`voterToken:${sessionId}`)
    
    const res = await fetch(`${API_URL}/session/${sessionId}/vote`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          option, voterToken
        })
      }
    )
    if(res.status==409){
      alert("You've already voted in this poll");
      return;
    }
    if(!res.ok){
      alert("Failed to vote");
      return;
    }
  }

  function resetSession(){
    localStorage.removeItem("currentSession");
    setSession(null);
    setSessionId("");
    setJoin(true);
  }
  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-5xl font-bold text-white text-center mb-8 tracking-tight">zappity</h1>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sessionId && session ?(
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4"> 
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Live Poll
                </div>
                <div className="text-xs text-gray-500 mb-1">Session ID</div>
                <div className="text-lg font-mono font-semibold text-gray-800 bg-gray-100 px-4 py-2 rounded-lg inline-block">{sessionId}</div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">{session.title}</h2>
                <div className="space-y-3"> 
                  {Object.entries(session.votes).map(([option, votes]) => {
                    const total = Object.values(session.votes).reduce((acc, curr) => acc+curr, 0);
                    const percentage = total > 0 ? Math.round((votes/total)*100) : 0;

                    return(
                      <div key={option} className="relative">
                        <button 
                        onClick={(e) => {e.preventDefault(); handleVote(option);}}
                        className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-200 group"
                          >
                          <div className="absolute inset-0 bg-blue-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"> </div>
                          <div className="relative flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800">{option}</div>
                              <div className="text-sm text-gray-500 mt-1">{votes} {votes === 1 ? "vote" : "votes"} • {percentage}%</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-2xl font-bold text-blue-600">{votes}</div>
                              <svg className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-500" 
                            style={{ width: `${percentage}%` }} >
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <button 
              onClick={resetSession}
              className="w-full mt-6 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Create new poll
              </button>
            </div>
          ):(
            <>
            <div className="flex gap-2 mb-8 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setJoin(true)}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  join
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Join Poll
              </button>
              <button
                onClick={() => setJoin(false)}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  join
                    ? 'text-gray-600 hover:text-gray-800'
                    : 'bg-white text-blue-600 shadow-sm'
                }`}
                >
                Create Poll
              </button>
            </div>

            {join ?(
              <div className="space-y-6">
                <div className="">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Join a poll</h2>
                  <p className="text-gray-500 text-sm">Enter the code shared with you</p>
                </div>
                <form onSubmit={(e)=> {e.preventDefault(); joinSessionWithId(joinSessionId); setJoinSessionId("")}}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Poll code
                    </label>
                    <input 
                    type="text"
                    placeholder="Enter session ID"
                    value={joinSessionId}
                    onChange={(e) => setJoinSessionId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none tracking-wider transition-colors text-lg text-center text-gray-900 font-mono "
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-800 transition-all shadow-lg hover:shadow-xl mt-2"
                    >
                      Join
                  </button>
                </form>
              </div>
              
            ):(
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Create a Poll</h2>
                  <p className="text-gray-500 text-sm">Ask a question and add options</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Poll Title
                    </label>
                    <input
                    name="sessionName" 
                    placeholder="What's your question" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-gray-900 "
                    />

                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options
                    </label>
                    <div>
                      {options.map((option, index) => (
                        <div key={index} className='relative'>
                          <span className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium'>
                            {index+1}
                          </span>
                          <input 
                            value={option}
                            onChange={(e)=> handleInputChange(index, e.target.value)}
                            onKeyDown={(e) => handleOnKeyDown(index, e)}
                            placeholder={`Option ${index+1}`}
                            className="w-full pl-10 pr-4 py-3 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Press Enter to add more options</p>
                  </div>

                 <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-800 transition-all shadow-lg hover:shadow-xl mt-2"
                    >
                      Create Poll
                  </button>               
                </form>
              </div>
            )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

export default App
