from rest_framework import serializers

from drf_extra_fields.fields import Base64ImageField

from .models import Image, Caption, ImageCaption, MaybeDataUrlValidator
from .models import get_canonical_image_url


class MaybeDataURLField(serializers.URLField):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.validators = [MaybeDataUrlValidator()]


class ImageSerializer(serializers.Serializer):
    url = MaybeDataURLField()
    img = serializers.ImageField()

    def get_or_create(self, **kwargs):
        id = Image.hash_url(self.validated_data['url'])
        is_created = False
        try:
            obj = Image.objects.get(id=id)
        except Image.DoesNotExist:
            obj = Image(id=id, **(kwargs | self.validated_data))
            is_created = True
        obj.save()
        return obj, is_created

    def create(self, validated_data):
        return Image.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for field in Image._meta.fields:
            if field.name in validated_data:
                setattr(instance, field.name, validated_data[field.name])
        instance.save()
        return instance

    def validate_url(self, value):
        return get_canonical_image_url(value)


class CaptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caption
        fields = ["text", "key"]

    def get_or_create(self, **kwargs):
        id = Caption.hash_text(self.validated_data['text'])
        is_created = False
        try:
            obj = Caption.objects.get(id=id)
        except Caption.DoesNotExist:
            obj = Caption(id=id, **(kwargs | self.validated_data))
            is_created = True
        obj.save()
        return obj, is_created


class ImageCaptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImageCaption
        fields = [
            "event_type",
            "initiator",
            "timestamp",
            "count",
            "caption",
            "image",
        ]


class ClientImageEndpointSerializer(serializers.Serializer):
    image = serializers.ImageField()
    url = MaybeDataURLField()
    caption = serializers.JSONField()
    event_type = serializers.CharField()
    initiator = serializers.CharField()
    timestamp = serializers.DateTimeField()
    count = serializers.IntegerField()

    def create(self, validated_data):
        validated_data = dict(validated_data)
        user = validated_data.get('user')
        image_data = {
            'img': validated_data.pop('image'),
            'url': validated_data.pop('url'),
        }
        serializer = ImageSerializer(data=image_data, context=self.context)
        serializer.is_valid(raise_exception=True)
        img, _ = serializer.get_or_create(created_by=user)
        caption_data = validated_data.pop("caption")
        serializer = CaptionSerializer(data=caption_data, context=self.context)
        serializer.is_valid(raise_exception=True)
        caption, _ = serializer.get_or_create(created_by=user)
        obj = ImageCaption(
            event_type=validated_data['event_type'],
            timestamp=validated_data['timestamp'],
            initiator=validated_data['initiator'],
            count=validated_data['count'],
            caption=caption,
            image=img,
            user=user,
        )
        obj.save()
        return obj
