import logging

import urllib

import rest_framework as rf
from rest_framework import authentication, permissions, parsers, renderers
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ClientImageEndpointSerializer, ImageCaptionSerializer

logger = logging.getLogger(__name__)


class AuthTokenValidationView(APIView):
    """
    View for an authorized user to attempt a connection for validating their token.
    """
    authentication_classes = [authentication.TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get']

    def get(self, request):
        return Response({
            'success': True,
        })


class ImageView(APIView):
    """
    View for an authorized user to post an image, typically via the Chrome extension.
    Handles the following steps:
        - inserts an image record, if the image does not exist
        - updates the user/image bridge table.
        - updates the user's image label records
    """
    authentication_classes = [authentication.TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser]
    renderer_classes = [renderers.JSONRenderer]
    http_method_names = ['post']

    def post(self, request):
        status = rf.status.HTTP_400_BAD_REQUEST
        result = None
        try:
            serializer = ClientImageEndpointSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            instance = serializer.save(user=request.user)
            result = ImageCaptionSerializer(instance, context={'request': request}).data
            status = rf.status.HTTP_200_OK
        except Exception as e:
            logging.error(f'Exception {type(e)} serializing image: {e}')
        finally:
            return Response({
                'errors': serializer.errors,
                'result': result,
            }, status=status)
