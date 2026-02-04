"""
Gigya Service - Wrapper around SAP Gigya Python SDK
Provides server-side Gigya authentication and user management
"""
import os
from typing import Dict, Optional, Any
from .gigya_sdk import GSRequest, SigUtils

class GigyaService:
    """
    Gigya Service for server-side authentication
    
    Uses official SAP Gigya Python SDK for:
    - User signature validation
    - Account info retrieval
    - JWT token validation
    - Session management
    """
    
    def __init__(self):
        self.api_key = os.getenv('GIGYA_API_KEY', '4_XQnjjmLc16oS7vqA6DvIAg')
        self.secret_key = os.getenv('GIGYA_SECRET_KEY', '')
        self.api_domain = 'eu1.gigya.com'  # EU1 region for Lenzing
        
    def validate_user_signature(
        self, 
        uid: str, 
        timestamp: str, 
        signature: str,
        expiration: int = 3600
    ) -> bool:
        """
        Validate Gigya user signature (UID + Timestamp + Signature)
        
        Args:
            uid: Gigya User ID
            timestamp: Unix timestamp when signature was created
            signature: Gigya signature
            expiration: Signature expiration in seconds (default: 1 hour)
            
        Returns:
            bool: True if signature is valid and not expired
        """
        if not self.secret_key:
            raise ValueError("GIGYA_SECRET_KEY not configured")
            
        return SigUtils.validateUserSignature(
            uid, 
            timestamp, 
            self.secret_key, 
            signature,
            expiration
        )
    
    def get_account_info(self, uid: str) -> Optional[Dict[str, Any]]:
        """
        Get account info from Gigya using UID
        
        Args:
            uid: Gigya User ID
            
        Returns:
            dict: Account info or None if error
        """
        if not self.secret_key:
            raise ValueError("GIGYA_SECRET_KEY not configured")
            
        request = GSRequest(
            apiKey=self.api_key,
            secretKey=self.secret_key,
            apiMethod='accounts.getAccountInfo',
            params={
                'UID': uid,
                'include': 'profile,data,emails,loginIDs'
            },
            useHTTPS=True
        )
        
        request.setAPIDomain(self.api_domain)
        response = request.send()
        
        if response.getErrorCode() == 0:
            return response.getData()
        else:
            print(f"Gigya API Error: {response.getErrorCode()} - {response.getErrorMessage()}")
            return None
    
    def search_accounts(self, query: str, limit: int = 100) -> Optional[Dict[str, Any]]:
        """
        Search accounts in Gigya
        
        Args:
            query: Gigya query string (e.g., "profile.email = 'user@example.com'")
            limit: Maximum number of results
            
        Returns:
            dict: Search results or None if error
        """
        if not self.secret_key:
            raise ValueError("GIGYA_SECRET_KEY not configured")
            
        request = GSRequest(
            apiKey=self.api_key,
            secretKey=self.secret_key,
            apiMethod='accounts.search',
            params={
                'query': query,
                'limit': limit
            },
            useHTTPS=True
        )
        
        request.setAPIDomain(self.api_domain)
        response = request.send()
        
        if response.getErrorCode() == 0:
            return response.getData()
        else:
            print(f"Gigya Search Error: {response.getErrorCode()} - {response.getErrorMessage()}")
            return None
    
    def validate_jwt(self, jwt_token: str) -> Optional[Dict[str, Any]]:
        """
        Validate Gigya JWT token
        
        Args:
            jwt_token: Gigya JWT token
            
        Returns:
            dict: JWT payload or None if invalid
        """
        if not self.secret_key:
            raise ValueError("GIGYA_SECRET_KEY not configured")
            
        request = GSRequest(
            apiKey=self.api_key,
            secretKey=self.secret_key,
            apiMethod='accounts.getJWTPublicKey',
            params={},
            useHTTPS=True
        )
        
        request.setAPIDomain(self.api_domain)
        response = request.send()
        
        if response.getErrorCode() == 0:
            # TODO: Implement JWT validation with public key
            # For now, return response data
            return response.getData()
        else:
            print(f"Gigya JWT Error: {response.getErrorCode()} - {response.getErrorMessage()}")
            return None
    
    def get_schema(self) -> Optional[Dict[str, Any]]:
        """
        Get Gigya schema (data schema, profile schema, etc.)
        
        Returns:
            dict: Schema info or None if error
        """
        if not self.secret_key:
            raise ValueError("GIGYA_SECRET_KEY not configured")
            
        request = GSRequest(
            apiKey=self.api_key,
            secretKey=self.secret_key,
            apiMethod='accounts.getSchema',
            params={},
            useHTTPS=True
        )
        
        request.setAPIDomain(self.api_domain)
        response = request.send()
        
        if response.getErrorCode() == 0:
            return response.getData()
        else:
            print(f"Gigya Schema Error: {response.getErrorCode()} - {response.getErrorMessage()}")
            return None


# Singleton instance
_gigya_service = None

def get_gigya_service() -> GigyaService:
    """Get singleton Gigya service instance"""
    global _gigya_service
    if _gigya_service is None:
        _gigya_service = GigyaService()
    return _gigya_service
