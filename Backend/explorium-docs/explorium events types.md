> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````

> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````

> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



> ## Documentation Index

> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt

> Use this file to discover all available pages before exploring further.



\# Add Webhook



> Add a webhook for events enrollments.







\## OpenAPI



````yaml post /v1/webhooks

openapi: 3.1.0

info:

&nbsp; title: Partner Service

&nbsp; version: 0.2.312

servers:

&nbsp; - url: https://api.explorium.ai

&nbsp;   description: AgentSource Server

security: \[]

paths:

&nbsp; /v1/webhooks:

&nbsp;   post:

&nbsp;     tags:

&nbsp;       - Webhooks

&nbsp;     summary: Add Webhook

&nbsp;     description: Add a webhook for events enrollments.

&nbsp;     operationId: add\_webhook

&nbsp;     parameters:

&nbsp;       - required: false

&nbsp;         schema:

&nbsp;           type: string

&nbsp;           title: Tenant

&nbsp;           name: tenant

&nbsp;           auto\_error: false

&nbsp;         name: tenant

&nbsp;         in: header

&nbsp;     requestBody:

&nbsp;       content:

&nbsp;         application/json:

&nbsp;           schema:

&nbsp;             $ref: '#/components/schemas/WebhookAddRequest'

&nbsp;       required: true

&nbsp;     responses:

&nbsp;       '200':

&nbsp;         description: Successful Response

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/WebhookAddResponse'

&nbsp;       '422':

&nbsp;         description: Validation Error

&nbsp;         content:

&nbsp;           application/json:

&nbsp;             schema:

&nbsp;               $ref: '#/components/schemas/HTTPValidationError'

&nbsp;     security:

&nbsp;       - APIKeyHeader: \[]

&nbsp;       - APIKeyHeader: \[]

components:

&nbsp; schemas:

&nbsp;   WebhookAddRequest:

&nbsp;     properties:

&nbsp;       request\_context:

&nbsp;         type: object

&nbsp;         title: Request Context

&nbsp;         example: null

&nbsp;         nullable: true

&nbsp;       partner\_id:

&nbsp;         type: string

&nbsp;         title: Partner Id

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;     additionalProperties: false

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - partner\_id

&nbsp;       - webhook\_url

&nbsp;     title: WebhookAddRequest

&nbsp;   WebhookAddResponse:

&nbsp;     properties:

&nbsp;       response\_context:

&nbsp;         $ref: '#/components/schemas/ResponseContext'

&nbsp;       created\_at:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Created At

&nbsp;       last\_modified\_time:

&nbsp;         type: string

&nbsp;         format: date-time

&nbsp;         title: Last Modified Time

&nbsp;       webhook\_url:

&nbsp;         type: string

&nbsp;         title: Webhook Url

&nbsp;       webhook\_secret:

&nbsp;         type: string

&nbsp;         title: Webhook Secret

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - response\_context

&nbsp;       - created\_at

&nbsp;       - last\_modified\_time

&nbsp;       - webhook\_url

&nbsp;       - webhook\_secret

&nbsp;     title: WebhookAddResponse

&nbsp;     description: 'This is base response model for all responses in partner service. '

&nbsp;   HTTPValidationError:

&nbsp;     properties:

&nbsp;       detail:

&nbsp;         items:

&nbsp;           $ref: '#/components/schemas/ValidationError'

&nbsp;         type: array

&nbsp;         title: Detail

&nbsp;     type: object

&nbsp;     title: HTTPValidationError

&nbsp;   ResponseContext:

&nbsp;     properties:

&nbsp;       correlation\_id:

&nbsp;         type: string

&nbsp;         title: Correlation Id

&nbsp;       request\_status:

&nbsp;         $ref: '#/components/schemas/RequestStatus'

&nbsp;       time\_took\_in\_seconds:

&nbsp;         type: number

&nbsp;         title: Time Took In Seconds

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - correlation\_id

&nbsp;       - request\_status

&nbsp;       - time\_took\_in\_seconds

&nbsp;     title: ResponseContext

&nbsp;   ValidationError:

&nbsp;     properties:

&nbsp;       loc:

&nbsp;         items:

&nbsp;           anyOf:

&nbsp;             - type: string

&nbsp;             - type: integer

&nbsp;         type: array

&nbsp;         title: Location

&nbsp;       msg:

&nbsp;         type: string

&nbsp;         title: Message

&nbsp;       type:

&nbsp;         type: string

&nbsp;         title: Error Type

&nbsp;     type: object

&nbsp;     required:

&nbsp;       - loc

&nbsp;       - msg

&nbsp;       - type

&nbsp;     title: ValidationError

&nbsp;   RequestStatus:

&nbsp;     type: string

&nbsp;     enum:

&nbsp;       - success

&nbsp;       - miss

&nbsp;       - failure

&nbsp;     title: RequestStatus

&nbsp;     description: >-

&nbsp;       The `RequestStatus` class is an enumeration that defines the possible

&nbsp;       statuses of a request.





&nbsp;       This enum is used to indicate whether a request was successful, missed,

&nbsp;       or failed. It ensures



&nbsp;       consistent handling of request statuses across the application.





&nbsp;       Attributes:

&nbsp;           SUCCESS: Indicates that the request was successfully processed.

&nbsp;           MISS: Indicates that the request did not find any matching data.

&nbsp;           FAILURE: Indicates that the request encountered an error or failure.

&nbsp; securitySchemes:

&nbsp;   APIKeyHeader:

&nbsp;     type: apiKey

&nbsp;     in: header

&nbsp;     name: api\_key



````



**> ## Documentation Index**

**> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt**

**> Use this file to discover all available pages before exploring further.**



**# Add Webhook**



**> Add a webhook for events enrollments.**







**## OpenAPI**



**````yaml post /v1/webhooks**

**openapi: 3.1.0**

**info:**

  **title: Partner Service**

  **version: 0.2.312**

**servers:**

  **- url: https://api.explorium.ai**

    **description: AgentSource Server**

**security: \[]**

**paths:**

  **/v1/webhooks:**

    **post:**

      **tags:**

        **- Webhooks**

      **summary: Add Webhook**

      **description: Add a webhook for events enrollments.**

      **operationId: add\_webhook**

      **parameters:**

        **- required: false**

          **schema:**

            **type: string**

            **title: Tenant**

            **name: tenant**

            **auto\_error: false**

          **name: tenant**

          **in: header**

      **requestBody:**

        **content:**

          **application/json:**

            **schema:**

              **$ref: '#/components/schemas/WebhookAddRequest'**

        **required: true**

      **responses:**

        **'200':**

          **description: Successful Response**

          **content:**

            **application/json:**

              **schema:**

                **$ref: '#/components/schemas/WebhookAddResponse'**

        **'422':**

          **description: Validation Error**

          **content:**

            **application/json:**

              **schema:**

                **$ref: '#/components/schemas/HTTPValidationError'**

      **security:**

        **- APIKeyHeader: \[]**

        **- APIKeyHeader: \[]**

**components:**

  **schemas:**

    **WebhookAddRequest:**

      **properties:**

        **request\_context:**

          **type: object**

          **title: Request Context**

          **example: null**

          **nullable: true**

        **partner\_id:**

          **type: string**

          **title: Partner Id**

        **webhook\_url:**

          **type: string**

          **title: Webhook Url**

      **additionalProperties: false**

      **type: object**

      **required:**

        **- partner\_id**

        **- webhook\_url**

      **title: WebhookAddRequest**

    **WebhookAddResponse:**

      **properties:**

        **response\_context:**

          **$ref: '#/components/schemas/ResponseContext'**

        **created\_at:**

          **type: string**

          **format: date-time**

          **title: Created At**

        **last\_modified\_time:**

          **type: string**

          **format: date-time**

          **title: Last Modified Time**

        **webhook\_url:**

          **type: string**

          **title: Webhook Url**

        **webhook\_secret:**

          **type: string**

          **title: Webhook Secret**

      **type: object**

      **required:**

        **- response\_context**

        **- created\_at**

        **- last\_modified\_time**

        **- webhook\_url**

        **- webhook\_secret**

      **title: WebhookAddResponse**

      **description: 'This is base response model for all responses in partner service. '**

    **HTTPValidationError:**

      **properties:**

        **detail:**

          **items:**

            **$ref: '#/components/schemas/ValidationError'**

          **type: array**

          **title: Detail**

      **type: object**

      **title: HTTPValidationError**

    **ResponseContext:**

      **properties:**

        **correlation\_id:**

          **type: string**

          **title: Correlation Id**

        **request\_status:**

          **$ref: '#/components/schemas/RequestStatus'**

        **time\_took\_in\_seconds:**

          **type: number**

          **title: Time Took In Seconds**

      **type: object**

      **required:**

        **- correlation\_id**

        **- request\_status**

        **- time\_took\_in\_seconds**

      **title: ResponseContext**

    **ValidationError:**

      **properties:**

        **loc:**

          **items:**

            **anyOf:**

              **- type: string**

              **- type: integer**

          **type: array**

          **title: Location**

        **msg:**

          **type: string**

          **title: Message**

        **type:**

          **type: string**

          **title: Error Type**

      **type: object**

      **required:**

        **- loc**

        **- msg**

        **- type**

      **title: ValidationError**

    **RequestStatus:**

      **type: string**

      **enum:**

        **- success**

        **- miss**

        **- failure**

      **title: RequestStatus**

      **description: >-**

        **The `RequestStatus` class is an enumeration that defines the possible**

        **statuses of a request.**





        **This enum is used to indicate whether a request was successful, missed,**

        **or failed. It ensures**



        **consistent handling of request statuses across the application.**





        **Attributes:**

            **SUCCESS: Indicates that the request was successfully processed.**

            **MISS: Indicates that the request did not find any matching data.**

            **FAILURE: Indicates that the request encountered an error or failure.**

  **securitySchemes:**

    **APIKeyHeader:**

      **type: apiKey**

      **in: header**

      **name: api\_key**



**````**



**> ## Documentation Index**

**> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt**

**> Use this file to discover all available pages before exploring further.**



**# Add Webhook**



**> Add a webhook for events enrollments.**







**## OpenAPI**



**````yaml post /v1/webhooks**

**openapi: 3.1.0**

**info:**

  **title: Partner Service**

  **version: 0.2.312**

**servers:**

  **- url: https://api.explorium.ai**

    **description: AgentSource Server**

**security: \[]**

**paths:**

  **/v1/webhooks:**

    **post:**

      **tags:**

        **- Webhooks**

      **summary: Add Webhook**

      **description: Add a webhook for events enrollments.**

      **operationId: add\_webhook**

      **parameters:**

        **- required: false**

          **schema:**

            **type: string**

            **title: Tenant**

            **name: tenant**

            **auto\_error: false**

          **name: tenant**

          **in: header**

      **requestBody:**

        **content:**

          **application/json:**

            **schema:**

              **$ref: '#/components/schemas/WebhookAddRequest'**

        **required: true**

      **responses:**

        **'200':**

          **description: Successful Response**

          **content:**

            **application/json:**

              **schema:**

                **$ref: '#/components/schemas/WebhookAddResponse'**

        **'422':**

          **description: Validation Error**

          **content:**

            **application/json:**

              **schema:**

                **$ref: '#/components/schemas/HTTPValidationError'**

      **security:**

        **- APIKeyHeader: \[]**

        **- APIKeyHeader: \[]**

**components:**

  **schemas:**

    **WebhookAddRequest:**

      **properties:**

        **request\_context:**

          **type: object**

          **title: Request Context**

          **example: null**

          **nullable: true**

        **partner\_id:**

          **type: string**

          **title: Partner Id**

        **webhook\_url:**

          **type: string**

          **title: Webhook Url**

      **additionalProperties: false**

      **type: object**

      **required:**

        **- partner\_id**

        **- webhook\_url**

      **title: WebhookAddRequest**

    **WebhookAddResponse:**

      **properties:**

        **response\_context:**

          **$ref: '#/components/schemas/ResponseContext'**

        **created\_at:**

          **type: string**

          **format: date-time**

          **title: Created At**

        **last\_modified\_time:**

          **type: string**

          **format: date-time**

          **title: Last Modified Time**

        **webhook\_url:**

          **type: string**

          **title: Webhook Url**

        **webhook\_secret:**

          **type: string**

          **title: Webhook Secret**

      **type: object**

      **required:**

        **- response\_context**

        **- created\_at**

        **- last\_modified\_time**

        **- webhook\_url**

        **- webhook\_secret**

      **title: WebhookAddResponse**

      **description: 'This is base response model for all responses in partner service. '**

    **HTTPValidationError:**

      **properties:**

        **detail:**

          **items:**

            **$ref: '#/components/schemas/ValidationError'**

          **type: array**

          **title: Detail**

      **type: object**

      **title: HTTPValidationError**

    **ResponseContext:**

      **properties:**

        **correlation\_id:**

          **type: string**

          **title: Correlation Id**

        **request\_status:**

          **$ref: '#/components/schemas/RequestStatus'**

        **time\_took\_in\_seconds:**

          **type: number**

          **title: Time Took In Seconds**

      **type: object**

      **required:**

        **- correlation\_id**

        **- request\_status**

        **- time\_took\_in\_seconds**

      **title: ResponseContext**

    **ValidationError:**

      **properties:**

        **loc:**

          **items:**

            **anyOf:**

              **- type: string**

              **- type: integer**

          **type: array**

          **title: Location**

        **msg:**

          **type: string**

          **title: Message**

        **type:**

          **type: string**

          **title: Error Type**

      **type: object**

      **required:**

        **- loc**

        **- msg**

        **- type**

      **title: ValidationError**

    **RequestStatus:**

      **type: string**

      **enum:**

        **- success**

        **- miss**

        **- failure**

      **title: RequestStatus**

      **description: >-**

        **The `RequestStatus` class is an enumeration that defines the possible**

        **statuses of a request.**





        **This enum is used to indicate whether a request was successful, missed,**

        **or failed. It ensures**



        **consistent handling of request statuses across the application.**





        **Attributes:**

            **SUCCESS: Indicates that the request was successfully processed.**

            **MISS: Indicates that the request did not find any matching data.**

            **FAILURE: Indicates that the request encountered an error or failure.**

  **securitySchemes:**

    **APIKeyHeader:**

      **type: apiKey**

      **in: header**

      **name: api\_key**



**````**



**> ## Documentation Index**

**> Fetch the complete documentation index at: https://developers.explorium.ai/llms.txt**

**> Use this file to discover all available pages before exploring further.**



**# Add Webhook**



**> Add a webhook for events enrollments.**







**## OpenAPI**



**````yaml post /v1/webhooks**

**openapi: 3.1.0**

**info:**

  **title: Partner Service**

  **version: 0.2.312**

**servers:**

  **- url: https://api.explorium.ai**

    **description: AgentSource Server**

**security: \[]**

**paths:**

  **/v1/webhooks:**

    **post:**

      **tags:**

        **- Webhooks**

      **summary: Add Webhook**

      **description: Add a webhook for events enrollments.**

      **operationId: add\_webhook**

      **parameters:**

        **- required: false**

          **schema:**

            **type: string**

            **title: Tenant**

            **name: tenant**

            **auto\_error: false**

          **name: tenant**

          **in: header**

      **requestBody:**

        **content:**

          **application/json:**

            **schema:**

              **$ref: '#/components/schemas/WebhookAddRequest'**

        **required: true**

      **responses:**

        **'200':**

          **description: Successful Response**

          **content:**

            **application/json:**

              **schema:**

                **$ref: '#/components/schemas/WebhookAddResponse'**

        **'422':**

          **description: Validation Error**

          **content:**

            **application/json:**

              **schema:**

                **$ref: '#/components/schemas/HTTPValidationError'**

      **security:**

        **- APIKeyHeader: \[]**

        **- APIKeyHeader: \[]**

**components:**

  **schemas:**

    **WebhookAddRequest:**

      **properties:**

        **request\_context:**

          **type: object**

          **title: Request Context**

          **example: null**

          **nullable: true**

        **partner\_id:**

          **type: string**

          **title: Partner Id**

        **webhook\_url:**

          **type: string**

          **title: Webhook Url**

      **additionalProperties: false**

      **type: object**

      **required:**

        **- partner\_id**

        **- webhook\_url**

      **title: WebhookAddRequest**

    **WebhookAddResponse:**

      **properties:**

        **response\_context:**

          **$ref: '#/components/schemas/ResponseContext'**

        **created\_at:**

          **type: string**

          **format: date-time**

          **title: Created At**

        **last\_modified\_time:**

          **type: string**

          **format: date-time**

          **title: Last Modified Time**

        **webhook\_url:**

          **type: string**

          **title: Webhook Url**

        **webhook\_secret:**

          **type: string**

          **title: Webhook Secret**

      **type: object**

      **required:**

        **- response\_context**

        **- created\_at**

        **- last\_modified\_time**

        **- webhook\_url**

        **- webhook\_secret**

      **title: WebhookAddResponse**

      **description: 'This is base response model for all responses in partner service. '**

    **HTTPValidationError:**

      **properties:**

        **detail:**

          **items:**

            **$ref: '#/components/schemas/ValidationError'**

          **type: array**

          **title: Detail**

      **type: object**

      **title: HTTPValidationError**

    **ResponseContext:**

      **properties:**

        **correlation\_id:**

          **type: string**

          **title: Correlation Id**

        **request\_status:**

          **$ref: '#/components/schemas/RequestStatus'**

        **time\_took\_in\_seconds:**

          **type: number**

          **title: Time Took In Seconds**

      **type: object**

      **required:**

        **- correlation\_id**

        **- request\_status**

        **- time\_took\_in\_seconds**

      **title: ResponseContext**

    **ValidationError:**

      **properties:**

        **loc:**

          **items:**

            **anyOf:**

              **- type: string**

              **- type: integer**

          **type: array**

          **title: Location**

        **msg:**

          **type: string**

          **title: Message**

        **type:**

          **type: string**

          **title: Error Type**

      **type: object**

      **required:**

        **- loc**

        **- msg**

        **- type**

      **title: ValidationError**

    **RequestStatus:**

      **type: string**

      **enum:**

        **- success**

        **- miss**

        **- failure**

      **title: RequestStatus**

      **description: >-**

        **The `RequestStatus` class is an enumeration that defines the possible**

        **statuses of a request.**





        **This enum is used to indicate whether a request was successful, missed,**

        **or failed. It ensures**



        **consistent handling of request statuses across the application.**





        **Attributes:**

            **SUCCESS: Indicates that the request was successfully processed.**

            **MISS: Indicates that the request did not find any matching data.**

            **FAILURE: Indicates that the request encountered an error or failure.**

  **securitySchemes:**

    **APIKeyHeader:**

      **type: apiKey**

      **in: header**

      **name: api\_key**



**````**





