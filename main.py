from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import openai
import os
from dotenv import load_dotenv
from typing import Union
import json
import re
import sys
from io import StringIO

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

openai.api_key = os.getenv("OPENAI_API_KEY")


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to restrict allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load OpenAI API key from environment variable
client = OpenAI(api_key=openai.api_key)

class ExecInterrupt(Exception):
    pass

def Exec(source, globals=None, locals=None):
    try:
        exec(source, globals, locals)
    except ExecInterrupt:
        pass

class QueryRequest(BaseModel):
    prompt: str
    metadata: dict

class QueryResponse(BaseModel):
    descriptions: str
    vega_lite_spec: list[dict]

def sanitize_input(query: str) -> str:
    """Sanitize input to the Python REPL."""
    query = re.sub(r"^(\s|`)*(?i:python)?\s*", "", query)  # Remove whitespace, backtick & python (if any)
    query = re.sub(r"(\s|`)*$", "", query)  # Remove whitespace & ` from end
    return query

def execute_panda_dataframe_code(code: str) -> str:
    """Generate a Vega-Lite specification based on the provided code."""
    # Save the current standard output to restore later
    old_stdout = sys.stdout
    # Redirect standard output to a StringIO object to capture output
    sys.stdout = mystdout = StringIO()
    
    try:
        
        cleaned_command = sanitize_input(code)
        Exec(cleaned_command)  # Execute the provided code
        return mystdout.getvalue()  # Return captured output
    except Exception as e:
        return repr(e)
    finally:
        sys.stdout = old_stdout  # Restore the original standard output


def query(question, system_prompt, tools, tool_map, max_iterations=5):
    messages = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "user", "content": question})

    i = 0
    while i < max_iterations:
        print("new it.")
        i += 1
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini", temperature=0.0, messages=messages, tools=tools
            )
        except Exception as e:
            print("Error", e)

        if response.choices[0].message.content:
            # Handle regular response
            print(response.choices[0].message.content)

        if response.choices[0].message.tool_calls is None:
            break  # No tool calls

        messages.append(response.choices[0].message)
        
        for tool_call in response.choices[0].message.tool_calls:
            arguments = json.loads(tool_call.function.arguments)
            function_to_call = tool_map[tool_call.function.name]
            print(tool_call.function.name)
            print("arguments: ", arguments)
            result = function_to_call(**arguments)  # Call the function
            print(result)
            result_content = json.dumps({**arguments, "result": result})
            messages.append({
                "role": "tool",
                "content": result_content,
                "tool_call_id": tool_call.id,
            })

        if i == max_iterations and response.choices[0].message.tool_calls is not None:
            return "The tool agent could not complete the task in the given time. Please try again."
        

    return response.choices[0].message.content

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Endpoint to interact with OpenAI API via LangChain
@app.post("/query", response_model=QueryResponse)
async def query_openai(request: QueryRequest):
    try:
        def generate_vega_spec(data, prompt):
            client = OpenAI(api_key=openai.api_key)
            #metadata_str = '\n'.join([
                
                #f"Example {i+1}: " + ", ".join([f"{key}: {value}" for key, value in col.items()])
                #for i, col in enumerate(data)
            #])
            metadata_str = data
            relevance_prompt = (
                f"Given the following dataset:\n{metadata_str}\n\n"
                f"Please evaluate whether the following request contains content that is also in this dataset or is relevant to this dataset:\n"
                f"\"{prompt}\"\n"
                f"If the request is relevant to the dataset, respond with 'yes'. If it is not relevant to the dataset, respond with 'no'."
            )
            relevance_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": relevance_prompt}],
                model="gpt-3.5-turbo",
            )
            relevance_response = relevance_completion.choices[0].message.content.strip().lower()
            print(relevance_response)
            if relevance_response == "no":
                no_relevance_prompt = (
                    f"Given the following data:\n{metadata_str}\n\n"
                    f"In 1-2 sentences, explain in why the following request is not relevant to a data analysis or visualization task of the dataset: {prompt}."
                )

                no_relevance_completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": no_relevance_prompt}],
                    model="gpt-3.5-turbo",
                )

                no_relevance = no_relevance_completion.choices[0].message.content.strip()
                description=no_relevance
                vega_lite_spec=[]
                return {description: description, vega_lite_spec: vega_lite_spec}

            full_prompt = (
                f"Given the following dataset:\n{metadata_str}\n\n"
                f"Use this dataset to generate Vega-Lite specifications for the following visualization: {prompt}."
            )

            chat_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": full_prompt}],
                model="gpt-3.5-turbo",
            )

            try:
                vega_lite_specs = json.loads(chat_completion.choices[0].message.content)
            except json.JSONDecodeError as e:
                description="Vega-Lite specification is ill-formed and cannot be fixed. Please try again.",
                vega_lite_specs=[]
                print(description)
                return {description: description, vega_lite_spec: vega_lite_spec}


            '''description_prompt = (
                f"Based on the following Vega-Lite specification:\\n{json.dumps(vega_lite_spec)}\n\n"
                f"Please provide a one-sentence description of the chart."
            )

            description_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": description_prompt}],
                model="gpt-3.5-turbo",
            )

            description = description_completion.choices[0].message.content.strip()'''

            return vega_lite_specs

        system_prompt = (
        "You are a helpful assistant that can generate visualizations such as charts and answer data-driven queries such as averages or medians for the following dataset:"
        f"{request.metadata}"
        "If the user query asks to create a visualization, use the 'generate_vega_specification' tool from the tool map to generate a specification."
        "If the user query is a data-driven query, use the 'execute_code' tool from the tool map"      
        "For the 'execute_code' tool is used, use 'print(...)' to print the analysis."  
        )
        vega_tool_description = {
            "name": "generate_vega_specification",
            "description": (
                "Generates Vega-Lite specifications for a dataset based on a user query."
                "Call this when the user asks for visualizations, such as a bar chart, scatterplot, histogram, or summary table."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "The dataset"
                    },
                    "prompt": {
                        "type": "string",
                        "description": "The user query"
                    }
                },
                "required": ["data", "prompt"],
            },
        }

        data_tool_description = {
            "name": "execute_code",
            "description": (
                "Executes code to analyze data based on a user data query and returns a concise data analysis"
                "Call this when the user asks for analysis of data, such as mean, average, median, or range."
                "range means give a minimum and maximum, not the difference between the minimum and maximum."
                "Make sure to use 'print(...)' to output the analysis"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "The code that generates the data analysis."
                    }
                },
                "required": ["code"],
            },
        }
        

        vega_tool = {
            "type" : "function",
            "function" : vega_tool_description
        }

        data_tool = {
            "type" : "function",
            "function" : data_tool_description
        }

        tools = [vega_tool, data_tool]

        tool_map = {
            "generate_vega_specification": generate_vega_spec,
            "execute_code": execute_panda_dataframe_code
        }
        
        response = query(request.prompt, system_prompt, tools, tool_map)
        print(response)

        # Extract the descriptions and Vega-Lite specifications
        descriptions = "h"

        json_matches = re.findall(r'```json\n(.*?)\n```', response, re.DOTALL)

        vega_lite_specs = []
        description = response  # Initialize description with full response text

        for json_str in json_matches:
            try:
                # Try to load the extracted JSON block to verify it's valid
                vega_lite_spec = json.loads(json_str.strip())
                vega_lite_specs.append(vega_lite_spec)
                
                # Remove the JSON block from the description
                description = description.replace(f'```json\n{json_str}\n```', '')
            except json.JSONDecodeError:
                continue  # Handle any JSON parsing errors as needed

        # Remove any remaining excess newlines from the description
        descriptions = description.strip()
        print("de", descriptions, "de")
        try:
            return QueryResponse(descriptions=descriptions, vega_lite_spec=vega_lite_specs)
        except Exception as e:
            print(e)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def read_root():
    return FileResponse('venv/client/src/App.js')