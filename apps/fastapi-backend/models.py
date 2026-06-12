import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ARRAY
from pgvector.sqlalchemy import Vector
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class KnowledgeProject(Base):
    __tablename__ = "knowledge_projects" # 必须与原本的 Prisma 表名一致

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    iconUrl = Column("iconUrl", String, nullable=True) # 强制指定列名为骆驼拼写法
    color = Column(String, nullable=True)
    userId = Column("userId", String, nullable=True)
    isPublic = Column("isPublic", Boolean, default=True)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)
    updatedAt = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Skill(Base):
    __tablename__ = "skills"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    triggerKws = Column("triggerKws", ARRAY(String), nullable=True)
    embedding = Column(Vector(1536), nullable=True)
    isPublic = Column("isPublic", Boolean, default=True)
    # The Prisma schema maps these as fields, we just need basic SQLAlchemy mappings
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)
    updatedAt = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SkillTriggerLog(Base):
    __tablename__ = "skill_trigger_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    sessionId = Column("sessionId", String, nullable=True)
    messageId = Column("messageId", String, nullable=True)
    triggeredIds = Column("triggeredIds", ARRAY(String), nullable=True)
    injectedTokens = Column("injectedTokens", Integer, nullable=True)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)
