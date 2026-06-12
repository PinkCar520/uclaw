import os
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

class EmbeddingService:
    _instance = None
    _client = None
    _model_name = "text-embedding-3-small" # default to openai's latest small model

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = EmbeddingService()
            # It will automatically pick up OPENAI_API_KEY and OPENAI_BASE_URL from env
            logger.info("Initializing OpenAI API client for remote embeddings...")
            cls._instance._client = OpenAI()
            cls._instance._model_name = os.getenv("EMBEDDING_MODEL_NAME", "text-embedding-3-small")
        return cls._instance

    def get_embedding(self, text: str) -> list[float]:
        if not self._client:
            raise RuntimeError("OpenAI Client not initialized")
        
        # Replace newlines with spaces as recommended by OpenAI for older models, 
        # though text-embedding-3 handles it well, it's good practice
        text = text.replace("\n", " ")
        
        response = self._client.embeddings.create(
            input=[text],
            model=self._model_name
        )
        return response.data[0].embedding

# Global helper function for ease of use
def generate_embedding(text: str) -> list[float]:
    service = EmbeddingService.get_instance()
    return service.get_embedding(text)
