$pptx = "C:\EspritMarket\projetmicroservice\SMART-COMPUS-ESPRIT-5SE3-FRONT-END\public\uploads\Delice_Holding_DD_RSE-1.pptx"
$pdf = "C:\EspritMarket\projetmicroservice\SMART-COMPUS-ESPRIT-5SE3-FRONT-END\public\uploads\Delice_Holding_DD_RSE-1.pdf"

Write-Output "Opening PowerPoint..."
$ppt = New-Object -ComObject PowerPoint.Application
try {
    $presentation = $ppt.Presentations.Open($pptx, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    Write-Output "Exporting to PDF: $pdf"
    $presentation.SaveAs($pdf, 32)
    $presentation.Close()
    Write-Output "SUCCESS"
} catch {
    Write-Output "ERROR: $_"
} finally {
    $ppt.Quit()
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
