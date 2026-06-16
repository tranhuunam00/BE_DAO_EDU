import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ListFacebookLeadScansDto,
  SubmitFacebookLeadScanDto,
} from '../../application/dtos/facebook-lead-scan.dto';
import { Role } from '../../domain/value-objects/role.enum';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import {
  GetFacebookLeadScanUseCase,
  ListFacebookLeadScansUseCase,
  SubmitFacebookLeadScanUseCase,
  GetScannedPostIdsUseCase,
} from '../../modules/facebook-lead-scans/application/use-cases/manage-facebook-lead-scans.use-cases';

@Controller('facebook-lead-scans')
export class FacebookLeadScanController {
    private readonly submitScan: SubmitFacebookLeadScanUseCase,
    private readonly listScans: ListFacebookLeadScansUseCase,
    private readonly getScan: GetFacebookLeadScanUseCase,
    private readonly getScannedPostIds: GetScannedPostIdsUseCase,
  ) {}

  @Post()
  async submit(
    @Body() dto: SubmitFacebookLeadScanDto,
    @Headers('x-dao-edu-scanner-token') scannerToken?: string,
  ) {
    this.assertScannerToken(scannerToken);
    try {
      const scan = await this.submitScan.execute(dto);
      return {
        ok: true,
        scanId: scan.id,
        scanSessionId: scan.scanSessionId,
        acceptedItems: scan.acceptedItems,
        duplicateItems: scan.duplicateItems,
        itemCount: scan.itemCount,
        detection: scan.detection,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'FACEBOOK_LEAD_SCAN_EMPTY'
      ) {
        throw new BadRequestException('Khong co du lieu quet de dong bo.');
      }
      throw error;
    }
  }

  @Get('sync/scanned-posts')
  async getScannedPosts(
    @Query('groupUrl') groupUrl: string,
    @Headers('x-dao-edu-scanner-token') scannerToken?: string,
  ) {
    this.assertScannerToken(scannerToken);
    if (!groupUrl) {
      throw new BadRequestException('groupUrl is required');
    }
    const postIds = await this.getScannedPostIds.execute(groupUrl);
    return { ok: true, postIds };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  list(@Query() query: ListFacebookLeadScansDto) {
    return this.listScans.execute(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async detail(@Param('id') id: string) {
    try {
      return await this.getScan.execute(id);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'FACEBOOK_LEAD_SCAN_NOT_FOUND'
      ) {
        throw new NotFoundException('Khong tim thay lan quet Facebook.');
      }
      throw error;
    }
  }

  private assertScannerToken(scannerToken?: string) {
    const expectedToken = process.env.SCANNER_SYNC_TOKEN;
    if (!expectedToken) return;
    if (scannerToken === expectedToken) return;
    throw new UnauthorizedException('Scanner token khong hop le.');
  }
}
