from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, *args, **kwargs):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

class LeadStatus(str, Enum):
    PENDING = "PENDING"
    CALL_INITIATED = "CALL_INITIATED"
    QUALIFIED = "QUALIFIED"
    NOT_INTERESTED = "NOT_INTERESTED"
    FAILED = "FAILED"
    NEEDS_REVIEW = "NEEDS_REVIEW"

class Company(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    instructions: str
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class Customer(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    company_id: str
    name: str
    phone_number: str
    status: LeadStatus = LeadStatus.PENDING
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class CallLog(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    customer_id: str
    vapi_call_id: str
    transcript: str
    summary: Optional[str] = None
    outcome: str
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class UserSettings(BaseModel):
    email_alerts: bool = False
    auto_polling: bool = True
    dark_mode: bool = False

class User(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    full_name: str
    email: str
    password_hash: str
    role: str = "Admin"
    settings: UserSettings = Field(default_factory=UserSettings)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class Notification(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: str
    title: str
    message: str
    type: str = "info"  # info, success, warning, error
    is_read: bool = False
    created_at: str
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
