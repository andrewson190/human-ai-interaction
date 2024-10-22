import { useState, useRef, useEffect } from 'react';
import AI from './assets/ai.jpg'
import Human from './assets/human.avif'
import './App.css';
import FileUpload from './components/FileUpload';
import { Vega } from 'react-vega';
import SpinnerIcon from './assets/spinner.svg'
const url = process.env.NODE_ENV === 'production' ? 'https://human-ai-interaction.onrender.com/' : 'http://127.0.0.1:8000/';

function App() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("No response yet");
  const [chatHistory, setChatHistory] = useState([]);
  const [fulldata, setData] = useState([])
  const [metadata, setMetadata] = useState([]); 
  const [vegaSpec, setVegaSpec] = useState(null); 

  const handleData = (x) => {
    setData(x)
  }

  const handleMetadataChange = (columns) => {
    setMetadata(columns);
  };
  
  function sendMessage () {
    if (!fulldata || fulldata.length === 0) {
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { text: message, sender: 'user' },
        { text: "Please upload a dataset before sending a message", sender: 'bot' }
        ]);
      setMessage('')
      return;
    }

    if (message.trim()) {

      const requestBody = {
        prompt: message,
        metadata: metadata, 
      };
      // Show user's message and "Working on it..." message with spinner immediately
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { text: message, sender: 'user' }, 
        { text: "Working on it... This may take a few seconds.", sender: 'bot', loading: true }
      ]);

      fetch(`${url}query`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }

      }).then(response => {
        return response.json();

      }).then(data => {
        if (Object.keys(data.vega_lite_spec).length === 0) {
          setChatHistory((prevHistory) => {
            const updatedHistory = prevHistory.slice(0, -1);  // Remove the last "Working on it..." message
            return [
              ...updatedHistory,
              { text: data.descriptions, sender: 'bot' },
            ];
          });
        }

        else {
          // Array to hold the text for the chat message
      
          // Iterate through each Vega-Lite specification and update its data
          const updatedSpecs = data.vega_lite_spec.map((spec, index) => {
            const updatedSpec = {
              ...spec,
              data: {
                values: fulldata,
              },
            };
            
            return updatedSpec; // Return the updated spec
          });
      
          // Set the updated specs in the state
          setVegaSpec(updatedSpecs);
      
          // Add the combined message as a single chat entry
          setChatHistory((prevHistory) => {
            const updatedHistory = prevHistory.slice(0, -1); // Remove the last "Working on it..." message
            return [
              ...updatedHistory,
              { 
                text: data.descriptions, // Join the combined message array into a single string
                sender: 'bot',
                vegaSpecs: updatedSpecs // Store the full specs for rendering the charts later
              },
            ];
          });
        }
        
      })
      .catch(() => {
        setChatHistory((prevHistory) => {
          const updatedHistory = prevHistory.slice(0, -1);  // Remove the last "Working on it..." message
          return [
            ...updatedHistory,
            { text: "Something went wrong. Please try again.", sender: 'bot' }
          ];
        });
      });
    }
    setMessage('');
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
    <div data-theme="light" className="container mx-auto pt-10 pb-20 h-auto ">
      <h1 className="text-4xl ml-40">AI Assistant</h1>
      <div className="flex flex-col items-center justify-center w-full h-full">
        <FileUpload onMetadataChange={handleMetadataChange} handleData={handleData}/>
      </div>
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
                  className={` chat-bubble p-3 rounded-lg max-w-lg text-white text-sm ${
                    message.sender === 'user' ? 'bg-violet-950 text-right' : 'bg-violet-950 text-left'
                  }`}
                >
                  {message.vegaSpecs && message.vegaSpecs.map((spec, specIndex) => (
                    <div>
                      <div className="flex justify-center mt-4 mb-4" key={specIndex}>
                        <Vega spec={spec}/>
                      </div>

                    </div>
                  ))}
                  {message.text === "Working on it... This may take a few seconds." && message.sender==='bot' && message.text}
                  {message.sender ==='user' && message.text}
                  {message.sender ==='bot' && message.text !== "Working on it... This may take a few seconds." && message.text && (
                    <div>
                    {console.log(message.text, "hi")}
                    {message.text.split('\n').map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                    </div>
                  )}
                  {message.loading && (
                    <div className="flex justify-center items-center">
                      <img src={SpinnerIcon} className={'mt-2'}/>
                    </div>
                  )}

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
          className="border-gray-200 border-2 input input-bordered w-3/5 ml-5 p-3 pl-4 rounded-3xl " 
          onInput={handleMessage} 
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendMessage(); 
            }
          }}
        />
        <button className="btn bg-gray-200 rounded-3xl px-10 mx-2 text-sm text-violet-800" onClick={sendMessage}>Send</button>
        <button className="btn bg-gray-200 rounded-3xl px-10 mx-2 text-sm text-violet-800" onClick={() => setChatHistory([])}>Clear Messages</button>
      </div>
    </div>
  );
}

export default App;
