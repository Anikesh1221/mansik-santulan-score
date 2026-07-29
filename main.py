import joblib
from fastapi import FastAPI 
from pydantic import BaseModel , Field
import pandas as pd
from typing import Literal
from fastapi.middleware.cors import CORSMiddleware


model = joblib.load("MentalHealthModel.pkl")

top_countries = [
    "Other",
    "India",
    "USA",
    "Canada",
    "Australia",
    "UK",
    "Germany",
    "Mexico",
    "Turkey",
    "France",
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# pydantic model
class StudentData(BaseModel):
    Age: int = Field(...,ge=10,le=100)
    Gender: Literal['Male','Female']
    country: str
    Academic_Level: Literal['Undergraduate', 'Graduate', 'High School']
    
    Most_Used_Platform: Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter',
       'YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp',
       'WeChat']
    
    Purpose_Of_Use: Literal['Networking', 'Education', 'Entertainment', 'News']
    
    Avg_Daily_Usage_Hours: float = Field(...,ge=0,le=24)
    Daily_Unlocks: int = Field(...,ge=0)
    Physical_Activity_Hours:float = Field(...,ge=0,le=24)
    Sleep_Hours_Per_Night: float = Field(...,ge=0,le=24)
    Study_Hours: float = Field(...,ge=0,le=24)
    
    Stress_Level: Literal['Medium', 'Low', 'Very High', 'High']
    
    
    

# decribe what we send back
class predictionResponse(BaseModel):
    predicted_mental_healthScore :float



@app.post("/predict",response_model=predictionResponse)
def predict(data: StudentData):

    country_group = data.country if data.country in top_countries else "Other"
    input_row = pd.DataFrame(
        [
            {
                "Age": data.Age,
                "Gender": data.Gender,
                "Country" : data.country,
                "Academic_Level": data.Academic_Level,
                "Most_Used_Platform": data.Most_Used_Platform,
                "Purpose_Of_Use": data.Purpose_Of_Use,
                "Avg_Daily_Usage_Hours": data.Avg_Daily_Usage_Hours,
                "Daily_Unlocks": data.Daily_Unlocks,
                "Physical_Activity_Hours": data.Physical_Activity_Hours,
                "Sleep_Hours_Per_Night": data.Sleep_Hours_Per_Night,
                "Study_Hours": data.Study_Hours,
                "Stress_Level": data.Stress_Level,
                "Grouped_country": country_group
            }
        ]
    )
    
    
    prediction = model.predict(input_row)[0]
    return predictionResponse(predicted_mental_healthScore=round(float(prediction),2))
