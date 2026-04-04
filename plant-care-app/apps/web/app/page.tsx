import { redirect } from 'next/navigation'

/** La raíz redirige siempre a /plants (el layout protegido gestiona el auth). */
export default function HomePage() {
  redirect('/plants')
}
