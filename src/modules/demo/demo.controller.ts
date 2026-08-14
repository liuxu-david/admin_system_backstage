import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("Demo")
@Controller("demo")
export class DemoController {
  @Get()
  @ApiOperation({ summary: "Demo endpoint - returns sample data" })
  getDemo() {
    return {
      message: "This is a demo endpoint",
      data: {
        items: [
          { id: 1, name: "Item 1" },
          { id: 2, name: "Item 2" },
          { id: 3, name: "Item 3" },
        ],
      },
    };
  }

  @Get("error")
  @ApiOperation({ summary: "Demo error endpoint - throws a test error" })
  getError() {
    throw new Error("This is a demo error");
  }
}
