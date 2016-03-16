from settings import *

DATABASES['default']['USER'] = '{{user}}'
DATABASES['default']['PASSWORD'] = '{{password}}'
DATABASES['default']['HOST'] = '{{host}}'
DATABASES['default']['PORT'] = '{{port}}'
DATABASES['default']['POSTGIS_TEMPLATE'] = '{{postgisTemplate}}'

{{#windows}}
GDAL_LIBRARY_PATH = 'C:/OSGeo4W{{#x64}}64{{/x64}}/bin/gdal111.dll'
{{/windows}}

TIME_ZONE = '{{{timezone}}}'
LANGUAGE_CODE = '{{{defaultLanguage}}}'

{{#mediaPath}}
MEDIA_ROOT =  '{{{mediaPath}}}'
{{/mediaPath}}
