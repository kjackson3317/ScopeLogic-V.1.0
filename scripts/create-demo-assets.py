from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

out=Path('public/demo');out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',32)
img=Image.new('RGBA',(760,110),'white');d=ImageDraw.Draw(img)
d.rectangle((4,10,72,90),fill='#56642a');d.text((19,30),'TP',font=font,fill='white')
d.text((92,13),'TECHNOLOGY PRECONSTRUCTION',font=font,fill='#26302b')
d.text((92,57),'WORKSPACE',font=font,fill='#56642a');img.save(out/'wordmark.png')
icon=Image.new('RGB',(96,96),'#56642a');ImageDraw.Draw(icon).text((24,28),'TP',font=font,fill='white');icon.save(out/'icon.png')
c=canvas.Canvas(str(out/'Municipal-Technology-Plans.pdf'),pagesize=(1000,700))
c.setTitle('Municipal Public Safety Facility - Fictional Technology Plans');c.setAuthor('Technology Preconstruction Workspace')
for sheet in range(2):
 c.setStrokeColor(HexColor('#24363f'));c.setLineWidth(1);c.rect(24,24,952,652)
 c.setFont('Helvetica-Bold',15);c.drawString(45,647,'MUNICIPAL PUBLIC SAFETY FACILITY')
 c.setFont('Helvetica',10);c.drawString(45,629,'Fictional presentation drawing | Technology systems | Rev 2 | NOT FOR CONSTRUCTION')
 c.setLineWidth(3);c.rect(90,145,700,440)
 for x in [200,310,420,530,640,750]:
  c.line(x,145,x,320);c.line(x,365,x,585)
 c.line(90,320,790,320);c.line(90,365,790,365)
 c.setLineWidth(.8);c.setFont('Helvetica',8)
 for row in range(2):
  for col in range(6):
   x=96+col*110;y=398 if row else 225
   c.drawString(x,y,('OFFICE ' if row else 'SUPPORT ')+str(101+row*6+col+sheet*20))
 c.setFont('Helvetica-Bold',10);c.drawString(370,340,'CENTRAL CORRIDOR')
 c.setStrokeColor(HexColor('#66816c'));c.setDash(5,3);c.line(115,352,765,352);c.setDash()
 for i in range(24):
  x=140+(i%6)*110;y=700-(200+(i//6)*95)
  c.setStrokeColor(HexColor('#7b8790'));c.circle(x,y,5,fill=0);c.setFont('Helvetica',7);c.drawString(x+8,y-2,'D2' if sheet==0 else 'CAM')
 c.setStrokeColor(HexColor('#26302b'));c.line(90,110,690,110)
 for x in [90,690]:c.line(x,100,x,125)
 c.setFont('Helvetica-Bold',12);c.drawCentredString(390,90,'60 FT — KNOWN CALIBRATION DIMENSION')
 c.setFont('Helvetica',9);c.drawString(810,566,'LEGEND');c.drawString(810,546,'D2   Dual data outlet');c.drawString(810,528,'CAM   Camera');c.drawString(810,510,'WAP   Wireless outlet');c.drawString(810,480,'Dashed: cable pathway')
 c.drawString(810,450,'1. Confirm all routes.');c.drawString(810,432,'2. Keep systems distinct.');c.drawString(810,414,'3. Calibrate each sheet.');c.drawString(810,396,'4. Illustrative only.')
 c.setFont('Helvetica-Bold',13);c.drawString(810,90,f'T{sheet+1}.01');c.setFont('Helvetica',9);c.drawString(810,72,'LEVEL '+str(sheet+1)+' TECHNOLOGY')
 c.showPage()
c.save()
print('Created neutral identity and two fictional drawing sheets.')
