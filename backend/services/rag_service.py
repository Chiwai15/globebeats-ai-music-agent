import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any
import json
from datetime import datetime


class RAGService:
    def __init__(self):
        # Initialize ChromaDB in-memory
        self.chroma_client = chromadb.Client(ChromaSettings(
            anonymized_telemetry=False,
            is_persistent=False
        ))

        # Create collection for music data
        try:
            self.collection = self.chroma_client.get_collection("music_data")
        except:
            self.collection = self.chroma_client.create_collection(
                name="music_data",
                metadata={"description": "Global music trends by country"}
            )

        # Initialize embedding model
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')

    def update_music_data(self, countries_data: List[Dict[str, Any]]):
        """Update vector database with latest music data"""
        documents = []
        metadatas = []
        ids = []

        for country in countries_data:
            # Create document for each country
            tracks_text = "\n".join([
                f"- {track['name']} by {track['artist']}"
                for track in country.get('tracks', [])
            ])

            doc_text = f"""
Country: {country['country_name']} ({country['country_code']})
Data Source: {country['source']}
Top Tracks:
{tracks_text}
Updated: {country['updated_at']}
            """.strip()

            documents.append(doc_text)
            metadatas.append({
                "country_code": country['country_code'],
                "country_name": country['country_name'],
                "source": country['source'],
                "track_count": len(country.get('tracks', [])),
                "updated_at": country['updated_at']
            })
            ids.append(country['country_code'])

        # Upsert to ChromaDB
        if documents:
            # Delete existing documents first
            try:
                self.collection.delete(ids=ids)
            except:
                pass

            # Add new documents
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )

    def search_relevant_context(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Search for relevant music data based on query"""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )

        contexts = []
        if results['documents'] and results['documents'][0]:
            for i, doc in enumerate(results['documents'][0]):
                contexts.append({
                    "text": doc,
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i] if results.get('distances') else None
                })

        return contexts

    def get_all_countries_summary(self) -> str:
        """Get a summary of all countries in the database"""
        all_data = self.collection.get()

        if not all_data['metadatas']:
            return "No music data available yet."

        countries = [m['country_name'] for m in all_data['metadatas']]
        return f"I have music data for {len(countries)} countries: {', '.join(sorted(countries))}"

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the RAG database"""
        all_data = self.collection.get()

        return {
            "total_countries": len(all_data['ids']) if all_data['ids'] else 0,
            "last_updated": datetime.utcnow().isoformat()
        }
