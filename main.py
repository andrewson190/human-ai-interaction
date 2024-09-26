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
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class MetadataItem(BaseModel):
    name: str
    type: str
    sample: list[Union[str, int, float]]

class QueryRequest(BaseModel):
    prompt: str
    metadata: list[MetadataItem]

class QueryResponse(BaseModel):
    description: str
    vega_lite_spec: dict

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Endpoint to interact with OpenAI API via LangChain
@app.post("/query", response_model=QueryResponse)
async def query_openai(request: QueryRequest):
    try:
        client = OpenAI(api_key=openai.api_key)

        metadata_str = "\n".join([
            f"{col.name} ({col.type}): {', '.join(map(str, col.sample))}"  # Include all samples
            for col in request.metadata
        ])
        
        relevance_prompt = (
            f"Given the following dataset:\n{metadata_str}\n\n"
            f"Please evaluate whether the following request contains content that is also in this dataset or is relevant to this dataset:\n"
            f"\"{request.prompt}\"\n"
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
                f"In 1-2 sentences, explain in why the following request is not relevant to a data analysis or visualization task of the dataset: {request.prompt}."
            )

            no_relevance_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": no_relevance_prompt}],
                model="gpt-3.5-turbo",
            )

            no_relevance = no_relevance_completion.choices[0].message.content.strip()
            return QueryResponse(
                description=no_relevance,
                vega_lite_spec={}
            )
        
        full_prompt = (
            f"Given the following dataset:\n{metadata_str}\n\n"
            f"Use this dataset to generate a Vega-Lite specification for the following visualization: {request.prompt}."
        )

        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": full_prompt}],
            model="gpt-3.5-turbo",
        )

        try:
            vega_lite_spec = json.loads(chat_completion.choices[0].message.content)
        except json.JSONDecodeError as e:
            return QueryResponse(
                description="Vega-Lite specification is ill-formed and cannot be fixed. Please try again.",
                vega_lite_spec={}
            )

        description_prompt = (
            f"Based on the following Vega-Lite specification:\n{json.dumps(vega_lite_spec)}\n\n"
            f"Please provide a one-sentence description of the chart."
        )

        description_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": description_prompt}],
            model="gpt-3.5-turbo",
        )

        description = description_completion.choices[0].message.content.strip()

        return QueryResponse(description=description, vega_lite_spec=vega_lite_spec)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def read_root():
    return FileResponse('venv/client/src/App.js')