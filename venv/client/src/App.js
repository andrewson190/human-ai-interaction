
import { useState, useRef, useEffect } from 'react';
import AI from './assets/ai.jpg'
import Human from './assets/human.avif'
import './App.css';
import FileUpload from './components/FileUpload';

const url = process.env.NODE_ENV === 'production' ? 'https://course-tools-demo.onrender.com/' : 'http://127.0.0.1:8000/';

function App() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("No response yet");
  const [chatHistory, setChatHistory] = useState([]);
  
  function sendMessage () {

    if (message.trim()) {
      fetch(`${url}query`, {
        method: 'POST',
        body: JSON.stringify({ prompt: message }),
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(response => {
        return response.json();
      }).then(data => {
        setResponse(data.response);
        setChatHistory((prevHistory) => [
          ...prevHistory,
          { text: message, sender: 'user' }, 
          { text: data.response, sender: 'bot' }  
        ]);
      })
      
      setMessage('');

    }
  };


  function handleMessage(e) {   
    setMessage(e.target.value); 
  }

  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  return (
    <div data-theme="light" className="container mx-auto pt-20 pb-40 h-auto ">
      <h1 className="text-4xl ml-40">AI Assistant</h1>
      <FileUpload />
      <div className="flex justify-center">
        <div className="mt-5 border-2 border-gray-200 h-96 w-4/5 shadow overflow-y-scroll [&::-webkit-scrollbar]:hidden pt-2"  ref={chatContainerRef}>
          {chatHistory.map((message, index) => (
            
            <div
              key={index}
              className={`flex ${message.sender === 'user' ? 'justify-end mr-2' : 'justify-start ml-2'} mb-6 items-end`}
            >
              {message.sender !== 'user' &&
                <img 
                  src={AI} 
                  className={'h-12 w-12 rounded-3xl mr-2'}
                />
              }
            <div className={message.sender === 'user' ? "chat chat-end" : "chat chat-start"}>
              <div
                className={` chat-bubble p-3 rounded-lg max-w-lg text-white text-sm	${
                  message.sender === 'user' ? 'bg-violet-950 text-right' : 'bg-violet-950 text-left'
                }`}
              >
                {message.text}
              </div>
            </div>

              {message.sender === 'user' &&
                <img 
                  src={Human} 
                  className={'h-12 w-12 rounded-3xl ml-4'}
                />
              }
            </div>
          ))}
        </div>
      </div>
      <div className=" flex gap-2 ml-40 mt-5">
        <input 
          type="text" 
          placeholder="Type your message here" 
          value={message} 
          className="border-gray-200 border-2 input input-bordered w-4/5 ml-5 p-3 pl-4 rounded-3xl " 
          onInput={handleMessage} 
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendMessage(); 
            }
          }}
        />
        <button className="btn bg-gray-200 rounded-3xl px-6 text-sm text-violet-800" onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;
