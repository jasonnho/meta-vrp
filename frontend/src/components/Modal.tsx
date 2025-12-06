// src/components/Modal.tsx
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { X } from 'lucide-react'

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : void 0)}>
      <DialogContent
        // ukuran & responsif
        className='sm:max-w-4xl w-[95vw] p-0 overflow-hidden'
      >
        {/* Header sticky agar tombol close & judul selalu terlihat */}
        <DialogHeader className='sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-3 border-b'>
          <div className='flex items-center justify-between'>
            <DialogTitle className='text-base font-semibold'>{title ?? 'Details'}</DialogTitle>
            <DialogClose asChild>
              <Button variant='ghost' size='icon' aria-label='Close'>
                <X className='h-4 w-4' />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Konten scrollable, batasi tinggi biar modal nggak kepanjangan */}
        <div className='max-h-[80vh] overflow-y-auto px-4 py-4'>{children}</div>
      </DialogContent>
    </Dialog>
  )
}
